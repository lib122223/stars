import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";
import { Body, Illumination, SearchRiseSet, Observer } from "astronomy-engine";
import { fetchWeather, fetchHourlyForecast } from "@/lib/weather";

function parseCoord(raw: string | null): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (Number.isNaN(n)) return null;
  return n;
}

function fmtTime(d: unknown): string | null {
  if (!d) return null;
  // SearchRiseSet returns AstroTime with .date property
  const date = (d as { date?: Date }).date ?? (d as Date);
  return date.toISOString();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");
  const lat = parseCoord(latRaw) ?? 39.9;
  const lng = parseCoord(lngRaw) ?? 116.4;

  if (latRaw != null && parseCoord(latRaw) == null) {
    return apiError(ErrorCode.INVALID_PARAMS, "lat must be a valid number");
  }
  if (lngRaw != null && parseCoord(lngRaw) == null) {
    return apiError(ErrorCode.INVALID_PARAMS, "lng must be a valid number");
  }

  // 今晚月光计算
  const now = new Date();
  const obs = new Observer(lat, lng, 0);
  const illum = Illumination(Body.Moon, now);
  const phaseFraction = illum.phase_fraction;
  const moonRise = SearchRiseSet(Body.Moon, obs, 1, now, 1.0);
  const moonSet = SearchRiseSet(Body.Moon, obs, -1, now, 1.0);
  const moon = {
    phaseFraction: Math.round(phaseFraction * 100) / 100,
    rise: fmtTime(moonRise),
    set: fmtTime(moonSet),
  };

  // 今晚观测窗口
  const sunSet = SearchRiseSet(Body.Sun, obs, -1, now, 1.0);
  const sunRise = SearchRiseSet(Body.Sun, obs, 1, now, 1.0);
  const sun = {
    set: fmtTime(sunSet),
    rise: fmtTime(sunRise),
  };

  // 天气数据
  const weather = await fetchWeather(lat, lng);
  const hourlyForecast = await fetchHourlyForecast(lat, lng);

  // 附近更优区域：四个方向偏移比较云量
  const directions = [
    { label: "北方约30km", dlat: 0.3, dlng: 0 },
    { label: "南方约30km", dlat: -0.3, dlng: 0 },
    { label: "东方约30km", dlat: 0, dlng: 0.3 },
    { label: "西方约30km", dlat: 0, dlng: -0.3 },
  ];
  let nearbyBest: { label: string; diff: number } | null = null;
  let anyNearbySucceeded = false;
  const currentCloud = weather.cloud?.cover ?? 100;
  for (const d of directions) {
    try {
      const w = await fetchWeather(lat + d.dlat, lng + d.dlng);
      const c = w.cloud?.cover;
      if (c != null) {
        anyNearbySucceeded = true;
        if (currentCloud - c >= 20) {
          const diff = currentCloud - c;
          if (!nearbyBest || diff > nearbyBest.diff) {
            nearbyBest = { label: d.label, diff };
          }
        }
      }
    } catch { /* 单点失败跳过 */ }
  }
  const nearby = nearbyBest
    ? { recommended: true, summary: `${nearbyBest.label}处云量低${nearbyBest.diff}%，观测条件更优` }
    : anyNearbySucceeded
    ? { recommended: false, summary: "附近区域条件接近" }
    : null;

  // verdict 判定：月光 > 80% 或云量 > 70% 时观测受限
  const moonBright = phaseFraction > 0.8;
  const cloudy = weather.cloud != null && weather.cloud.cover > 70;

  return apiSuccess({
    verdict: {
      suitable: !moonBright && !cloudy,
      summary: moonBright && cloudy
        ? `今晚月光较强（满月 ${Math.round(phaseFraction * 100)}%）且云量偏高（${weather.cloud!.cover}%），建议改天再看。`
        : moonBright
        ? `今晚月光较强（满月 ${Math.round(phaseFraction * 100)}%），适合看月球和少数亮行星。`
        : cloudy
        ? `今晚云量偏高（${weather.cloud!.cover}%），大部分天空被遮挡，建议等云散再看。`
        : "今晚月光较暗，云量适中，适合先从明亮目标开始观察。",
    },
    moon,
    sun,
    cloud: weather.cloud,
    clarity: weather.clarity,
    nearby,
    hourlyForecast,
  });
}
