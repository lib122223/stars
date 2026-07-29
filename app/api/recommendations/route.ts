import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";
import { fetchObservationSnapshot } from "@/lib/observation-snapshot";
import type { VisibleSkyObject } from "@/lib/astronomy/sky-visibility";

function parseCoord(raw: string | null): number | null {
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function recommendationId(slug: string, offset: number): number {
  return offset + [...slug].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function buildRecommendation(
  primary: VisibleSkyObject,
  secondary: VisibleSkyObject | null,
  snapshot: Awaited<ReturnType<typeof fetchObservationSnapshot>>,
) {
  const time = new Date(snapshot.visibleSky.observationTime).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const count = snapshot.visibleSky.objects.length;

  return {
    primaryRecommendation: {
      id: recommendationId(primary.slug, 1000),
      title: `今晚先看${primary.name}`,
      reason: `${primary.direction}方向，高度 ${primary.altitude.toFixed(0)}°，${primary.visibilityLabel}。`,
      recommendationType: "object",
      targetRef: primary.slug,
      primaryAction: { label: "去星图找它", type: "open_sky_map" },
      secondaryAction: {
        label: "先了解一下",
        type: "open_object_detail",
        targetRef: primary.slug,
      },
    },
    conditionSummary: {
      basis: `${snapshot.lightPollution.label}，预计肉眼极限约 ${snapshot.visibleSky.limitingMagnitude.toFixed(1)} 等`,
      actionHint: `按 ${time} 的观测条件估算，今晚有 ${count} 个目录目标可尝试`,
    },
    secondaryRecommendation: secondary
      ? {
          id: recommendationId(secondary.slug, 2000),
          text: `也可以先看：${secondary.name}，位于${secondary.direction}方向`,
          recommendationType: "object",
          targetRef: secondary.slug,
        }
      : {
          id: 2999,
          text: "今晚可靠可见目标较少，先从最亮的对象开始",
          recommendationType: "direction",
          targetRef: "bright-star-entry",
        },
    visibleSky: snapshot.visibleSky,
    lightPollution: snapshot.lightPollution,
  };
}

const generalFallback = {
  primaryRecommendation: {
    id: 201,
    title: "今晚先从最亮的目标开始",
    reason: "获取位置后会按夜光、天气、月光和真实天空位置筛选目标。",
    recommendationType: "direction",
    targetRef: "brightest-visible-target",
    primaryAction: { label: "去星图找它", type: "open_sky_map" },
    secondaryAction: { label: "先了解一下", type: "open_object_detail", targetRef: null as string | null },
  },
  conditionSummary: {
    basis: "未获取定位信息，暂时无法计算当地可见星表",
    actionHint: "允许定位后可查看今晚实际可见目标",
  },
  secondaryRecommendation: {
    id: 202,
    text: "也可以先看：今晚最容易辨认的亮星",
    recommendationType: "object",
    targetRef: "bright-star-entry",
  },
};

const noVisibleTargetFallback = {
  primaryRecommendation: {
    id: 301,
    title: "今晚可靠可见目标较少",
    reason: "当前夜光、天气、月光或天体高度不利于肉眼观测。",
    recommendationType: "direction",
    targetRef: "brightest-visible-target",
    primaryAction: { label: "去星图看看", type: "open_sky_map" },
    secondaryAction: { label: "查看观测条件", type: "open_object_detail", targetRef: null as string | null },
  },
  conditionSummary: {
    basis: "完整可见性计算未筛出可靠目标",
    actionHint: "可以在附近暗夜地图选择夜光更少的位置",
  },
  secondaryRecommendation: {
    id: 302,
    text: "先查看附近暗夜区域和稍后的观测窗口",
    recommendationType: "location",
    targetRef: "bright-star-entry",
  },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");
  const lat = parseCoord(latRaw);
  const lng = parseCoord(lngRaw);

  if (latRaw != null && (lat == null || lat < -90 || lat > 90)) {
    return apiError(ErrorCode.INVALID_PARAMS, "lat must be between -90 and 90");
  }
  if (lngRaw != null && (lng == null || lng < -180 || lng > 180)) {
    return apiError(ErrorCode.INVALID_PARAMS, "lng must be between -180 and 180");
  }
  if (lat == null || lng == null) return apiSuccess(generalFallback);

  try {
    const snapshot = await fetchObservationSnapshot(lat, lng);
    const [primary, secondary] = snapshot.visibleSky.recommended;
    if (!primary) {
      return apiSuccess({
        ...noVisibleTargetFallback,
        visibleSky: snapshot.visibleSky,
        lightPollution: snapshot.lightPollution,
      });
    }
    return apiSuccess(buildRecommendation(primary, secondary ?? null, snapshot));
  } catch {
    return apiSuccess(generalFallback);
  }
}
