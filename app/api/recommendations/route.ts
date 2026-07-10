import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";
import { Body, Equator, Horizon, MakeTime, Observer } from "astronomy-engine";

// ---- 内容对象池（11 条，对齐 celestial_objects seed） ----

interface PoolObject {
  slug: string;
  nameZh: string;
  objectType: string;
  /** RA in hours (for stars/constellations) or null (for planets — use Equator) */
  raHours: number | null;
  decDeg: number | null;
  /** brightness: lower = brighter. 行星用近似值，亮星用视星等 */
  magnitude: number;
  /** 亮星/行星权重更高 */
  rank: number;
}

const contentPool: PoolObject[] = [
  // 行星 — 通过 Body enum 计算
  { slug: "jupiter",    nameZh: "木星",   objectType: "planet",        raHours: null, decDeg: null, magnitude: -2.2, rank: 10 },
  { slug: "venus",      nameZh: "金星",   objectType: "planet",        raHours: null, decDeg: null, magnitude: -3.9, rank: 10 },
  { slug: "mars",       nameZh: "火星",   objectType: "planet",        raHours: null, decDeg: null, magnitude: -0.5, rank: 9 },
  { slug: "saturn",     nameZh: "土星",   objectType: "planet",        raHours: null, decDeg: null, magnitude:  0.8, rank: 8 },
  { slug: "moon",       nameZh: "月球",   objectType: "planet",        raHours: null, decDeg: null, magnitude: -12.7,rank: 10 },
  // 亮星 — 通过预存坐标 Horizon 直算
  { slug: "vega",       nameZh: "织女星", objectType: "bright_star",   raHours: 18.6156, decDeg:  38.7837, magnitude:  0.03, rank: 8 },
  { slug: "sirius",     nameZh: "天狼星", objectType: "bright_star",   raHours:  6.7525, decDeg: -16.7161, magnitude: -1.46, rank: 9 },
  { slug: "betelgeuse", nameZh: "参宿四", objectType: "bright_star",   raHours:  5.9195, decDeg:   7.4071, magnitude:  0.42, rank: 7 },
  { slug: "polaris",    nameZh: "北极星", objectType: "bright_star",   raHours:  2.5303, decDeg:  89.2641, magnitude:  1.98, rank: 6 },
  // 星座 — 中心坐标
  { slug: "orion",      nameZh: "猎户座", objectType: "constellation", raHours:  5.5,    decDeg:   5.0,    magnitude:  0.0,  rank: 7 },
  { slug: "ursa-major", nameZh: "大熊座", objectType: "constellation", raHours: 10.67,   decDeg:  55.0,    magnitude:  0.0,  rank: 5 },
];

const planetSlugs = new Set(["jupiter", "venus", "mars", "saturn", "moon"]);
const bodyBySlug: Record<string, Body> = {
  jupiter: Body.Jupiter, venus: Body.Venus, mars: Body.Mars,
  saturn: Body.Saturn, moon: Body.Moon,
};

// ---- 推荐规则 ----

interface VisibleObject {
  slug: string;
  nameZh: string;
  objectType: string;
  altitude: number;
  azimuth: number;
  magnitude: number;
}

/** 综合评分：亮度越高 + 高度角越合适 → 分数越高 */
function score(obj: VisibleObject): number {
  const altScore = Math.max(0, Math.min(obj.altitude, 60)) / 60; // 0-60° → 0-1
  const magScore = Math.max(0, 5 - obj.magnitude) / 5;            // 越亮越高
  return altScore * 0.6 + magScore * 0.4;
}

function buildRec(
  primary: VisibleObject,
  secondary: VisibleObject | null,
  basis: string,
  actionHint: string,
) {
  return {
    primaryRecommendation: {
      id: 1000 + contentPool.findIndex((o) => o.slug === primary.slug),
      title: `今晚先看${primary.nameZh}`,
      reason: `当前高度角 ${primary.altitude.toFixed(0)}°，亮度突出，适合新手先认。`,
      recommendationType: "object",
      targetRef: primary.slug,
      primaryAction: { label: "去星图找它", type: "open_sky_map" },
      secondaryAction: {
        label: "先了解一下",
        type: "open_object_detail",
        targetRef: primary.slug,
      },
    },
    conditionSummary: { basis, actionHint },
    secondaryRecommendation: secondary
      ? {
          id: 2000 + contentPool.findIndex((o) => o.slug === secondary.slug),
          text: `也可以先看：${secondary.nameZh}，也是一个很好的起点`,
          recommendationType: "object",
          targetRef: secondary.slug,
        }
      : {
          id: 2999,
          text: "今晚可见天体较少，不妨先抬头感受夜空",
          recommendationType: "direction",
          targetRef: "bright-star-entry",
        },
  };
}

// ---- 通用回退 ----

const generalFallback = {
  primaryRecommendation: {
    id: 201,
    title: "今晚先从最亮的目标开始",
    reason: "即使没有定位信息，也适合先认最容易观察到的明亮目标。",
    recommendationType: "direction",
    targetRef: "brightest-visible-target",
    primaryAction: { label: "去星图找它", type: "open_sky_map" },
    secondaryAction: { label: "先了解一下", type: "open_object_detail", targetRef: null as string | null },
  },
  conditionSummary: { basis: "未获取定位信息，先按通用夜空条件推荐", actionHint: "先从最明显的亮目标开始建立参照" },
  secondaryRecommendation: { id: 202, text: "也可以先看：今晚最容易辨认的亮星", recommendationType: "object", targetRef: "bright-star-entry" },
};

const allBelowHorizonFallback = {
  primaryRecommendation: {
    id: 301,
    title: "当前时刻可见天体较少",
    reason: "大多数目标在地平线以下，可以稍后再来，或先了解观星基础知识。",
    recommendationType: "direction",
    targetRef: "brightest-visible-target",
    primaryAction: { label: "去星图找它", type: "open_sky_map" },
    secondaryAction: { label: "先了解一下", type: "open_object_detail", targetRef: null as string | null },
  },
  conditionSummary: { basis: "当前时刻大多数天体在地平线以下", actionHint: "错过这段时间后，可以过一会儿再来看" },
  secondaryRecommendation: { id: 302, text: "可以先去了解今晚有哪些亮星值得等待", recommendationType: "object", targetRef: "bright-star-entry" },
};

// ---- 辅助 ----

function parseCoord(raw: string | null): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (Number.isNaN(n)) return null;
  return n;
}

// ---- 路由 ----

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");
  const sceneType = searchParams.get("sceneType");

  if (latRaw != null && parseCoord(latRaw) == null) {
    return apiError(ErrorCode.INVALID_PARAMS, "lat must be a valid number");
  }
  if (lngRaw != null && parseCoord(lngRaw) == null) {
    return apiError(ErrorCode.INVALID_PARAMS, "lng must be a valid number");
  }

  const lat = parseCoord(latRaw);
  const lng = parseCoord(lngRaw);

  // 无定位 → 通用回退
  if (lat == null || lng == null) {
    if (sceneType === "urban") {
      // 无定位但有场景 → 仍回退（无法计算真实可见性）
      return apiSuccess(generalFallback);
    }
    return apiSuccess(generalFallback);
  }

  // 有定位 → 真实计算
  const observer = new Observer(lat, lng, 0);
  const time = MakeTime(new Date());

  const visible: VisibleObject[] = [];

  for (const obj of contentPool) {
    try {
      let alt: number;
      let az: number;

      if (planetSlugs.has(obj.slug)) {
        const eq = Equator(bodyBySlug[obj.slug], time, observer, true, true);
        const hor = Horizon(time, observer, eq.ra, eq.dec);
        alt = hor.altitude;
        az = hor.azimuth;
      } else if (obj.raHours != null && obj.decDeg != null) {
        const hor = Horizon(time, observer, obj.raHours * 15, obj.decDeg);
        alt = hor.altitude;
        az = hor.azimuth;
      } else {
        continue;
      }

      if (alt > 0) {
        visible.push({ slug: obj.slug, nameZh: obj.nameZh, objectType: obj.objectType, altitude: alt, azimuth: az, magnitude: obj.magnitude });
      }
    } catch {
      // 单个对象计算失败不中断整体
    }
  }

  // 所有对象都不可见 → 通用回退
  if (visible.length === 0) {
    return apiSuccess(allBelowHorizonFallback);
  }

  // 排序 + 选 primary / secondary
  visible.sort((a, b) => score(b) - score(a));

  const primary = visible[0];
  const secondary = visible.length > 1 ? visible[1] : null;

  const basis = `基于位置 (${lat.toFixed(1)}°N, ${lng.toFixed(1)}°E) 的当前可见条件`;
  const hint = visible.length > 3
    ? `今晚可见天体较多，先从最亮的目标开始`
    : `今晚可见天体有限，抓住每一个明亮的对象`;

  return apiSuccess(buildRec(primary, secondary, basis, hint));
}
