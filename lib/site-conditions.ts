const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
import { Body, Equator, Horizon, MakeTime, Observer } from "astronomy-engine";

const AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

export interface SiteMetricPoint {
  time: string;
  cloudCover: number;
  cloudLow: number;
  cloudMid: number;
  cloudHigh: number;
  visibility: number;
  humidity: number;
  windSpeed: number;
  precipitationProbability: number;
  pm25: number | null;
  pm10: number | null;
}

export interface ConditionScore {
  score: number;
  label: string;
  bestTime: string | null;
  bestTimeIso: string | null;
  bestReferenceTime: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  direction: string;
  azimuth: number | null;
  altitude: number | null;
  summary: string;
  reasons: string[];
}

export interface DaySiteCondition {
  date: string;
  label: string;
  star: ConditionScore;
  sunsetGlow: ConditionScore;
  sunriseGlow: ConditionScore;
}

export interface SiteConditions {
  location: { lat: number; lng: number };
  generatedAt: string;
  dataSource: string;
  days: DaySiteCondition[];
}

interface OpenMeteoWeather {
  hourly?: {
    time?: string[];
    cloud_cover?: number[];
    cloud_cover_low?: number[];
    cloud_cover_mid?: number[];
    cloud_cover_high?: number[];
    visibility?: number[];
    relative_humidity_2m?: number[];
    wind_speed_10m?: number[];
    precipitation_probability?: number[];
  };
  daily?: {
    time?: string[];
    sunrise?: string[];
    sunset?: string[];
  };
}

interface OpenMeteoAir {
  hourly?: {
    time?: string[];
    pm2_5?: number[];
    pm10?: number[];
  };
}

function clampScore(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function scoreLabel(score: number): string {
  if (score >= 82) return "很好";
  if (score >= 68) return "适合";
  if (score >= 50) return "一般";
  return "不建议";
}

function fmtTime(raw: string | null): string | null {
  if (!raw) return null;
  const clockMatch = raw.match(/(?:T|\s)(\d{1,2}):(\d{2})/);
  if (clockMatch) return `${clockMatch[1].padStart(2, "0")}:${clockMatch[2]}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateTime(raw: Date | null): string | null {
  if (!raw) return null;
  if (Number.isNaN(raw.getTime())) return null;
  return raw.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function addMinutes(raw: string, minutes: number): Date {
  return new Date(new Date(raw).getTime() + minutes * 60_000);
}

function sunHorizontalAt(raw: string, lat: number, lng: number): { azimuth: number; altitude: number } | null {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const time = MakeTime(date);
  const observer = new Observer(lat, lng, 0);
  const equator = Equator(Body.Sun, time, observer, true, true);
  const horizon = Horizon(time, observer, equator.ra, equator.dec);
  return {
    azimuth: Number(horizon.azimuth.toFixed(1)),
    altitude: Number(horizon.altitude.toFixed(1)),
  };
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nearestPoints(points: SiteMetricPoint[], start: Date, end: Date): SiteMetricPoint[] {
  return points.filter((p) => {
    const t = new Date(p.time);
    return t >= start && t <= end;
  });
}

function bestBy(points: SiteMetricPoint[], score: (p: SiteMetricPoint) => number): SiteMetricPoint | null {
  let best: SiteMetricPoint | null = null;
  let bestScore = -Infinity;
  for (const p of points) {
    const s = score(p);
    if (s > bestScore) {
      best = p;
      bestScore = s;
    }
  }
  return best;
}

function starRawScore(p: SiteMetricPoint): number {
  const visibilityPenalty = Math.max(0, 9000 - p.visibility) / 1000 * 5;
  const humidityPenalty = Math.max(0, p.humidity - 72) * 0.7;
  const pmPenalty = p.pm25 == null ? 0 : Math.max(0, p.pm25 - 15) * 1.15;
  const windPenalty = Math.max(0, p.windSpeed - 25) * 0.35;
  return 100
    - p.cloudCover * 0.55
    - p.cloudLow * 0.18
    - p.precipitationProbability * 0.55
    - visibilityPenalty
    - humidityPenalty
    - pmPenalty
    - windPenalty;
}

function glowRawScore(p: SiteMetricPoint): number {
  const midHigh = (p.cloudMid + p.cloudHigh) / 2;
  const cloudColor = 100 - Math.abs(midHigh - 55) * 1.35;
  const tooClearPenalty = p.cloudCover < 12 ? 14 : 0;
  const visibilityPenalty = Math.max(0, 6500 - p.visibility) / 1000 * 3.5;
  const pmPenalty = p.pm25 == null ? 0 : Math.max(0, p.pm25 - 25) * 0.55;
  return cloudColor
    - p.cloudLow * 0.52
    - p.precipitationProbability * 0.62
    - visibilityPenalty
    - pmPenalty
    - tooClearPenalty;
}

function starReasons(p: SiteMetricPoint): string[] {
  const reasons = [
    `总云量 ${Math.round(p.cloudCover)}%，低云 ${Math.round(p.cloudLow)}%`,
    `降水概率 ${Math.round(p.precipitationProbability)}%，湿度 ${Math.round(p.humidity)}%`,
    `能见度约 ${(p.visibility / 1000).toFixed(1)} km`,
  ];
  if (p.pm25 != null) reasons.push(`PM2.5 约 ${Math.round(p.pm25)} μg/m³`);
  return reasons;
}

function glowReasons(p: SiteMetricPoint): string[] {
  const reasons = [
    `中高云 ${(p.cloudMid + p.cloudHigh) / 2 >= 25 ? "有" : "偏少"}，中云 ${Math.round(p.cloudMid)}%，高云 ${Math.round(p.cloudHigh)}%`,
    `低云 ${Math.round(p.cloudLow)}%，${p.cloudLow > 55 ? "可能遮挡地平线" : "地平线遮挡风险较低"}`,
    `降水概率 ${Math.round(p.precipitationProbability)}%，能见度约 ${(p.visibility / 1000).toFixed(1)} km`,
  ];
  if (p.pm25 != null) reasons.push(`PM2.5 约 ${Math.round(p.pm25)} μg/m³`);
  return reasons;
}

function makeCondition(
  kind: "star" | "sunset" | "sunrise",
  points: SiteMetricPoint[],
  windowStart: Date | null,
  windowEnd: Date | null,
  eventTime: string | null,
  location: { lat: number; lng: number },
): ConditionScore {
  if (points.length === 0) {
    return {
      score: 0,
      label: "暂无数据",
      bestTime: null,
      bestTimeIso: null,
      bestReferenceTime: null,
      windowStart: fmtDateTime(windowStart),
      windowEnd: fmtDateTime(windowEnd),
      azimuth: null,
      altitude: null,
      direction: kind === "sunrise" ? "东侧低空" : kind === "sunset" ? "西侧低空" : "全天空",
      summary: "该时间段暂无足够小时预报数据。",
      reasons: [],
    };
  }

  const raw = kind === "star" ? starRawScore : glowRawScore;
  const best = bestBy(points, raw) ?? points[0];
  const score = clampScore(raw(best));
  const label = scoreLabel(score);
  const time = fmtTime(best.time);
  const startText = fmtDateTime(windowStart);
  const endText = fmtDateTime(windowEnd);
  const sunPosition = kind === "star"
    ? null
    : sunHorizontalAt(eventTime ?? best.time, location.lat, location.lng);

  if (kind === "star") {
    return {
      score,
      label,
      bestTime: time,
      bestTimeIso: new Date(best.time).toISOString(),
      bestReferenceTime: time,
      windowStart: startText,
      windowEnd: endText,
      azimuth: null,
      altitude: null,
      direction: "抬头看全天，尽量避开城市光源方向",
      summary: score >= 68
        ? "云量和透明度可以支撑看星，适合找亮星、星座骨架和银河方向。"
        : score >= 50
        ? "可以尝试看亮星，但暗星和银河氛围会受影响。"
        : "看星条件偏弱，主要受云量、湿度、降水或空气透明度影响。",
      reasons: starReasons(best),
    };
  }

  const exactEventTime = eventTime ? fmtTime(eventTime) : time;
  const exactEventDate = eventTime ? new Date(eventTime) : null;

  return {
    score,
    label,
    bestTime: exactEventTime,
    bestTimeIso: exactEventDate && !Number.isNaN(exactEventDate.getTime())
      ? exactEventDate.toISOString()
      : new Date(best.time).toISOString(),
    bestReferenceTime: exactEventTime,
    windowStart: startText,
    windowEnd: endText,
    azimuth: sunPosition?.azimuth ?? null,
    altitude: sunPosition?.altitude ?? null,
    direction: kind === "sunset" ? "西侧低空" : "东侧低空",
    summary: score >= 68
      ? "云层结构比较适合出霞，建议提前到达并观察低空云边变化。"
      : score >= 50
      ? "有一定机会出霞，但云层或透明度不够稳定。"
      : "霞光条件偏弱，可能过于晴朗、低云遮挡或降水风险较高。",
    reasons: glowReasons(best),
  };
}

function buildMetricPoints(weather: OpenMeteoWeather, air: OpenMeteoAir): SiteMetricPoint[] {
  const h = weather.hourly ?? {};
  const airHourly = air.hourly ?? {};
  const airByTime = new Map<string, { pm25: number | null; pm10: number | null }>();
  const airTimes = airHourly.time ?? [];
  for (let i = 0; i < airTimes.length; i++) {
    airByTime.set(airTimes[i], {
      pm25: airHourly.pm2_5?.[i] ?? null,
      pm10: airHourly.pm10?.[i] ?? null,
    });
  }

  const times = h.time ?? [];
  return times.map((time, i) => {
    const airPoint = airByTime.get(time);
    return {
      time,
      cloudCover: h.cloud_cover?.[i] ?? 100,
      cloudLow: h.cloud_cover_low?.[i] ?? h.cloud_cover?.[i] ?? 100,
      cloudMid: h.cloud_cover_mid?.[i] ?? 0,
      cloudHigh: h.cloud_cover_high?.[i] ?? 0,
      visibility: h.visibility?.[i] ?? 10_000,
      humidity: h.relative_humidity_2m?.[i] ?? 70,
      windSpeed: h.wind_speed_10m?.[i] ?? 0,
      precipitationProbability: h.precipitation_probability?.[i] ?? 0,
      pm25: airPoint?.pm25 ?? null,
      pm10: airPoint?.pm10 ?? null,
    };
  });
}

export async function fetchSiteConditions(lat: number, lng: number): Promise<SiteConditions> {
  const weatherParams = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: [
      "cloud_cover",
      "cloud_cover_low",
      "cloud_cover_mid",
      "cloud_cover_high",
      "visibility",
      "relative_humidity_2m",
      "wind_speed_10m",
      "precipitation_probability",
    ].join(","),
    daily: "sunrise,sunset",
    forecast_days: "3",
    timezone: "auto",
  });
  const airParams = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: "pm2_5,pm10",
    forecast_days: "3",
    timezone: "auto",
  });

  const [weatherRes, airRes] = await Promise.all([
    fetch(`${WEATHER_URL}?${weatherParams.toString()}`, { next: { revalidate: 900 } }),
    fetch(`${AIR_URL}?${airParams.toString()}`, { next: { revalidate: 900 } }),
  ]);

  if (!weatherRes.ok) throw new Error("weather forecast failed");
  const weather = await weatherRes.json() as OpenMeteoWeather;
  const air = airRes.ok ? await airRes.json() as OpenMeteoAir : {};
  const points = buildMetricPoints(weather, air);

  const dates = weather.daily?.time ?? [];
  const sunrises = weather.daily?.sunrise ?? [];
  const sunsets = weather.daily?.sunset ?? [];

  const days: DaySiteCondition[] = [0, 1].map((idx) => {
    const sunset = sunsets[idx];
    const nextSunrise = sunrises[idx + 1] ?? sunrises[idx];
    const nightStart = sunset ? addMinutes(sunset, 90) : new Date();
    const nightEnd = nextSunrise ? addMinutes(nextSunrise, -75) : addMinutes(nightStart.toISOString(), 360);
    const sunsetStart = sunset ? addMinutes(sunset, -90) : nightStart;
    const sunsetEnd = sunset ? addMinutes(sunset, 60) : addMinutes(sunsetStart.toISOString(), 150);
    const sunriseStart = nextSunrise ? addMinutes(nextSunrise, -75) : nightStart;
    const sunriseEnd = nextSunrise ? addMinutes(nextSunrise, 45) : addMinutes(sunriseStart.toISOString(), 120);

    return {
      date: dates[idx] ?? dateKey(new Date()),
      label: idx === 0 ? "今天/今晚" : "明天",
      star: makeCondition("star", nearestPoints(points, nightStart, nightEnd), nightStart, nightEnd, null, { lat, lng }),
      sunsetGlow: makeCondition("sunset", nearestPoints(points, sunsetStart, sunsetEnd), sunsetStart, sunsetEnd, sunset ?? null, { lat, lng }),
      sunriseGlow: makeCondition("sunrise", nearestPoints(points, sunriseStart, sunriseEnd), sunriseStart, sunriseEnd, nextSunrise ?? null, { lat, lng }),
    };
  });

  return {
    location: { lat, lng },
    generatedAt: new Date().toISOString(),
    dataSource: "Open-Meteo 小时天气预报 + Open-Meteo 空气质量预报",
    days,
  };
}
