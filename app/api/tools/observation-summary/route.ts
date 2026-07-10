import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";

function parseCoord(raw: string | null): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (Number.isNaN(n)) return null;
  return n;
}

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

  // 第一阶段：轻量观测摘要，基于 sceneType 选择文案
  if (sceneType === "urban") {
    return apiSuccess({
      summary: "城市光污染较强，今晚适合从最亮的目标开始观察。",
      sceneSuggestion: "优先在阳台或窗边寻找月球和行星，它们在城市中也足够明亮。",
      weatherHint: "第一版天气提示为通用参考值，后续接入实时天气数据。",
    });
  }

  return apiSuccess({
    summary: "今晚云量较低，适合先从明亮目标开始观察。",
    sceneSuggestion: "如果在阳台，优先寻找亮星和行星。",
    weatherHint: "第一版先提供轻量天气提示，不提供复杂评分。",
  });
}
