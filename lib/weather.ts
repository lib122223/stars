/**
 * 天气数据接入层 — Open-Meteo 免费 API
 * 无需 API key，非商业使用无速率限制
 */

const BASE_URL = "https://api.open-meteo.com/v1/forecast";

export interface WeatherResult {
  cloud: { cover: number } | null;
  clarity: { level: string } | null;
}

export interface HourlyPoint {
  time: string;
  cloudCover: number;
  clarityLevel: string;
  visibility: number;
  humidity: number;
  windSpeed: number;
  precipitationProbability: number;
}

export interface CloudForecastPoint {
  time: string;
  cloudCover: number;
}

function clarityLevel(meters: number): string {
  if (meters >= 8000) return "清晰";
  if (meters >= 3000) return "一般";
  return "较差";
}

export async function fetchWeather(lat: number, lng: number): Promise<WeatherResult> {
  try {
    const url = `${BASE_URL}?latitude=${lat}&longitude=${lng}&current=cloud_cover,visibility`;
    const res = await fetch(url);
    if (!res.ok) return { cloud: null, clarity: null };
    const json = await res.json();
    const current = json.current;
    const cloudCover: number | undefined = current?.cloud_cover;
    const visibility: number | undefined = current?.visibility;
    return {
      cloud: cloudCover != null ? { cover: Math.round(cloudCover) } : null,
      clarity: visibility != null ? { level: clarityLevel(visibility) } : null,
    };
  } catch {
    return { cloud: null, clarity: null };
  }
}

/**
 * 获取今夜小时预报 — 今夜 18:00 到次日 06:00，2 小时间隔
 * 窗口起点 = max(今天 18:00, 当前时刻)
 */
export async function fetchHourlyForecast(lat: number, lng: number): Promise<HourlyPoint[]> {
  try {
    const now = new Date();
    const today18 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);
    const tomorrow6 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 6, 0, 0);
    const windowStart = today18 > now ? today18 : now;
    const windowEnd = tomorrow6;

    // 计算覆盖窗口所需的预报小时数 + 裕量
    const hoursNeeded = Math.ceil((windowEnd.getTime() - now.getTime()) / 3_600_000) + 4;

    const hourly =
      "cloud_cover,visibility,relative_humidity_2m,wind_speed_10m,precipitation_probability";
    const url = `${BASE_URL}?latitude=${lat}&longitude=${lng}&hourly=${hourly}&forecast_hours=${hoursNeeded}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const times: string[] = json.hourly?.time ?? [];
    const cloud: number[] = json.hourly?.cloud_cover ?? [];
    const vis: number[] = json.hourly?.visibility ?? [];
    const hum: number[] = json.hourly?.relative_humidity_2m ?? [];
    const wind: number[] = json.hourly?.wind_speed_10m ?? [];
    const precip: number[] = json.hourly?.precipitation_probability ?? [];

    // 筛选：时间在窗口内，且为偶数小时（18,20,22,0,2,4,6）
    const points: HourlyPoint[] = [];
    for (let i = 0; i < times.length; i++) {
      const d = new Date(times[i]);
      if (d < windowStart || d > windowEnd) continue;
      if (d.getHours() % 2 !== 0) continue; // 2 小时间隔
      points.push({
        time: times[i],
        cloudCover: Math.round(cloud[i] ?? 0),
        clarityLevel: clarityLevel(vis[i] ?? 10000),
        visibility: Math.round(vis[i] ?? 10000),
        humidity: Math.round(hum[i] ?? 50),
        windSpeed: Math.round(wind[i] ?? 0),
        precipitationProbability: Math.round(precip[i] ?? 0),
      });
    }
    return points;
  } catch {
    return [];
  }
}

/** Future UTC cloud cover used by time-specific observation predictions. */
export async function fetchCloudCoverForecast(
  lat: number,
  lng: number,
  forecastHours = 30,
): Promise<CloudForecastPoint[]> {
  try {
    const hours = Math.min(72, Math.max(1, Math.ceil(forecastHours)));
    const url = `${BASE_URL}?latitude=${lat}&longitude=${lng}&hourly=cloud_cover&forecast_hours=${hours}&timezone=UTC`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return [];

    const json = await res.json();
    const times: string[] = json.hourly?.time ?? [];
    const cloudCover: number[] = json.hourly?.cloud_cover ?? [];

    return times.flatMap((time, index) => {
      const cover = cloudCover[index];
      if (!Number.isFinite(cover)) return [];
      const utcTime = /(?:Z|[+-]\d{2}:\d{2})$/.test(time) ? time : `${time}Z`;
      return [{ time: new Date(utcTime).toISOString(), cloudCover: Math.round(cover) }];
    });
  } catch {
    return [];
  }
}
