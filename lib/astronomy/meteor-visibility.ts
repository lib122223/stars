import { Body, Equator, Horizon, Illumination, MakeTime, Observer } from "astronomy-engine";
import { stellarEquatorOfDate } from "@/lib/astronomy/stellar-coordinates";

export interface MeteorRadiant {
  slug: string;
  raHours: number;
  decDeg: number;
}

export interface MeteorVisibilityInput extends MeteorRadiant {
  nameZh: string;
  peakDate: string;
  activeStart: string;
  activeEnd: string;
  zhr: number;
}

export type MeteorVisibilityBand = "excellent" | "good" | "marginal" | "not_visible";

export interface MeteorVisibilityResult {
  band: MeteorVisibilityBand;
  score: number;
  activeNow: boolean;
  daysToPeak: number;
  bestTime: string | null;
  radiantAzimuth: number | null;
  radiantAltitude: number | null;
  direction: string;
  moonIllumination: number | null;
  summary: string;
}

const RADIANTS: Record<string, MeteorRadiant> = {
  perseids: { slug: "perseids", raHours: 3.2, decDeg: 58 },
  draconids: { slug: "draconids", raHours: 17.5, decDeg: 54 },
  orionids: { slug: "orionids", raHours: 6.35, decDeg: 16 },
  leonids: { slug: "leonids", raHours: 10.15, decDeg: 22 },
  geminids: { slug: "geminids", raHours: 7.47, decDeg: 33 },
  quadrantids: { slug: "quadrantids", raHours: 15.33, decDeg: 49 },
  lyrids: { slug: "lyrids", raHours: 18.07, decDeg: 34 },
  "eta-aquariids": { slug: "eta-aquariids", raHours: 22.53, decDeg: -1 },
};

export function meteorRadiantForSlug(slug: string): MeteorRadiant {
  return RADIANTS[slug] ?? { slug, raHours: 0, decDeg: 0 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function compassDirection(azimuth: number | null): string {
  if (azimuth == null) return "方向待计算";
  const labels = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
  return labels[Math.round(azimuth / 45) % labels.length];
}

function localHorizontal(
  date: Date,
  input: MeteorVisibilityInput,
  observer: Observer,
): { azimuth: number; altitude: number } {
  const time = MakeTime(date);
  const equator = stellarEquatorOfDate(input.raHours, input.decDeg, date);
  return Horizon(time, observer, equator.ra, equator.dec);
}

function sunAltitude(date: Date, observer: Observer): number {
  const time = MakeTime(date);
  const equator = Equator(Body.Sun, time, observer, true, true);
  return Horizon(time, observer, equator.ra, equator.dec).altitude;
}

function moonAt(date: Date, observer: Observer): { altitude: number; illumination: number } {
  const time = MakeTime(date);
  const equator = Equator(Body.Moon, time, observer, true, true);
  const horizontal = Horizon(time, observer, equator.ra, equator.dec);
  return {
    altitude: horizontal.altitude,
    illumination: Illumination(Body.Moon, date).phase_fraction,
  };
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.ceil((a.getTime() - b.getTime()) / 86_400_000));
}

function seasonDate(raw: string, peakDate: string, edge: "start" | "end"): Date {
  if (raw.length >= 10) return new Date(`${raw.slice(0, 10)}T${edge === "end" ? "23:59:59" : "00:00:00"}Z`);
  const peakYear = Number(peakDate.slice(0, 4));
  const monthDay = raw.slice(-5);
  let year = peakYear;
  const candidate = `${peakYear}-${monthDay}`;
  if (edge === "start" && candidate > peakDate) year -= 1;
  if (edge === "end" && candidate < peakDate) year += 1;
  return new Date(`${year}-${monthDay}T${edge === "end" ? "23:59:59" : "00:00:00"}Z`);
}

function isDateInRange(now: Date, input: MeteorVisibilityInput): boolean {
  const current = now.getTime();
  return current >= seasonDate(input.activeStart, input.peakDate, "start").getTime()
    && current <= seasonDate(input.activeEnd, input.peakDate, "end").getTime();
}

export function assessMeteorVisibility(
  input: MeteorVisibilityInput,
  location: { lat: number; lng: number },
  now = new Date(),
): MeteorVisibilityResult {
  const observer = new Observer(location.lat, location.lng, 0);
  const peak = new Date(`${input.peakDate}T00:00:00Z`);
  const activeNow = isDateInRange(now, input);
  let best: { date: Date; azimuth: number; altitude: number; moon: number } | null = null;

  // Sample a full local night around the peak. The UTC range is wide enough
  // to cover both eastern and western time zones without guessing a timezone.
  for (let minutes = -720; minutes <= 2160; minutes += 30) {
    const date = new Date(peak.getTime() + minutes * 60_000);
    if (sunAltitude(date, observer) > -12) continue;
    const horizontal = localHorizontal(date, input, observer);
    if (horizontal.altitude < 0) continue;
    const moon = moonAt(date, observer);
    if (!best || horizontal.altitude > best.altitude) {
      best = { date, azimuth: horizontal.azimuth, altitude: horizontal.altitude, moon: moon.illumination };
    }
  }

  const daysToPeak = daysBetween(peak, now);
  if (!best) {
    return {
      band: "not_visible",
      score: 0,
      activeNow,
      daysToPeak,
      bestTime: null,
      radiantAzimuth: null,
      radiantAltitude: null,
      direction: "当前地点难以看到辐射点",
      moonIllumination: null,
      summary: activeNow ? "这场流星雨正在活动，但辐射点在当地夜间高度过低。" : "峰值时段的辐射点在当地夜间不够高。",
    };
  }

  const altitudeFactor = clamp((best.altitude - 5) / 55, 0, 1);
  const moonPenalty = best.moon > 0.65 ? 18 : best.moon > 0.35 ? 9 : 0;
  const showerBonus = input.zhr >= 100 ? 10 : input.zhr >= 50 ? 5 : 0;
  const score = Math.round(clamp(altitudeFactor * 88 + showerBonus - moonPenalty, 0, 100));
  const band: MeteorVisibilityBand = score >= 78
    ? "excellent"
    : score >= 55
    ? "good"
    : score >= 28
    ? "marginal"
    : "not_visible";
  const direction = compassDirection(best.azimuth);
  const timing = activeNow ? "今晚" : daysToPeak === 0 ? "今晚峰值" : `${daysToPeak}天后峰值`;
  const condition = band === "excellent" ? "本地条件较好" : band === "good" ? "本地可以尝试" : "本地观测条件一般";

  return {
    band,
    score,
    activeNow,
    daysToPeak,
    bestTime: best.date.toISOString(),
    radiantAzimuth: Number(best.azimuth.toFixed(1)),
    radiantAltitude: Number(best.altitude.toFixed(1)),
    direction,
    moonIllumination: Number(best.moon.toFixed(2)),
    summary: `${timing}${condition}，辐射点在${direction}方向约${Math.round(best.altitude)}°。实际数量还会受云量和光污染影响。`,
  };
}
