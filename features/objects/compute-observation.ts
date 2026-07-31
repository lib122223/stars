import { Body, Equator, Horizon, MakeTime, Observer, SearchRiseSet, AstroTime } from "astronomy-engine";
import { findBrightStar } from "@/lib/astronomy/bright-stars";
import { stellarEquatorOfDate } from "@/lib/astronomy/stellar-coordinates";

interface ObservationData {
  status: "visible" | "rising_soon" | "not_visible";
  statusText: string;
  direction: string;
  azimuth: number;
  altitude: number;
  latitude: number;
  longitude: number;
  riseTime: string | null;
  setTime: string | null;
  bestMonths: string | null;
  advice: string;
}

const planetSlugs = new Set(["jupiter", "venus", "mars", "saturn", "moon"]);
const bodyBySlug: Record<string, Body> = {
  jupiter: Body.Jupiter, venus: Body.Venus, mars: Body.Mars,
  saturn: Body.Saturn, moon: Body.Moon,
};

/** 亮星/星座预存坐标（RA hours, Dec degrees） */
const coordBySlug: Record<string, { raHours: number; decDeg: number }> = {
  vega: { raHours: 18.6156, decDeg: 38.7837 },
  sirius: { raHours: 6.7525, decDeg: -16.7161 },
  betelgeuse: { raHours: 5.9195, decDeg: 7.4071 },
  polaris: { raHours: 2.5303, decDeg: 89.2641 },
  orion: { raHours: 5.5, decDeg: 5.0 },
  "ursa-major": { raHours: 10.67, decDeg: 55.0 },
};

function coordinatesForSlug(slug: string): { raHours: number; decDeg: number } | null {
  const brightStar = findBrightStar(slug);
  if (brightStar?.isActive) {
    return { raHours: brightStar.raHours, decDeg: brightStar.decDeg };
  }
  return coordBySlug[slug] ?? null;
}

function horizonForStar(
  observer: Observer,
  date: Date,
  coordinates: { raHours: number; decDeg: number },
) {
  const eq = stellarEquatorOfDate(coordinates.raHours, coordinates.decDeg, date);
  return Horizon(MakeTime(date), observer, eq.ra, eq.dec);
}

/** 8 方位中文 */
function azToDirection(az: number): string {
  const dirs = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
  const idx = Math.round(((az % 360) + 360) % 360 / 45) % 8;
  return dirs[idx];
}

function fmtTime(d: Date): string {
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function formatMonthRange(months: number[]): string {
  const normalized = [...new Set(months.map((month) => ((month % 12) + 12) % 12))].sort((a, b) => a - b);
  if (normalized.length === 0) return "暂无明显月份";
  if (normalized.length === 12) return "全年可见";

  const selected = new Set(normalized);
  const starts = normalized.filter((month) => !selected.has((month + 11) % 12));
  const ranges: Array<[number, number]> = [];

  for (const start of starts) {
    let end = start;
    while (selected.has((end + 1) % 12) && (end + 1) % 12 !== start) {
      end = (end + 1) % 12;
    }
    ranges.push([start, end]);
  }

  return ranges.map(([start, end]) => {
    if (start === end) return `${start + 1}月`;
    return end < start
      ? `${start + 1}月-次年${end + 1}月`
      : `${start + 1}月-${end + 1}月`;
  }).join("、");
}

function bestMonthsForStar(
  coordinates: { raHours: number; decDeg: number },
  observer: Observer,
  referenceDate: Date,
): string {
  const year = referenceDate.getFullYear();
  const samples = Array.from({ length: 12 }, (_, month) => {
    const sampleDate = new Date(year, month, 15, 21, 0, 0, 0);
    const horizontal = horizonForStar(observer, sampleDate, coordinates);
    return { month, altitude: horizontal.altitude };
  });
  const peakAltitude = Math.max(...samples.map((sample) => sample.altitude));
  if (peakAltitude < 15) return "本地晚间较难看见";

  const minimumAltitude = Math.max(20, peakAltitude - 15);
  const recommendedMonths = samples
    .filter((sample) => sample.altitude >= minimumAltitude)
    .map((sample) => sample.month);
  return formatMonthRange(recommendedMonths);
}

/** 为行星分别查询 rise (direction=1) 和 set (direction=-1) */
function planetRiseSet(
  body: Body,
  observer: Observer,
  startTime: AstroTime,
  searchDays: number,
): { rise: Date | null; set: Date | null } {
  try {
    const riseResult = SearchRiseSet(body, observer, 1, startTime, searchDays);
    const setResult = SearchRiseSet(body, observer, -1, startTime, searchDays);
    return {
      rise: riseResult?.date ?? null,
      set: setResult?.date ?? null,
    };
  } catch {
    return { rise: null, set: null };
  }
}

/** 为亮星/星座计算升落：时间扫描找 alt 过零点 */
function starRiseSet(
  raHours: number,
  decDeg: number,
  observer: Observer,
  now: Date,
): { rise: Date | null; set: Date | null } {
  const stepMin = 5;
  const scanHours = 24;
  const steps = (scanHours * 60) / stepMin;

  let prevAlt = horizonForStar(observer, now, { raHours, decDeg }).altitude;
  let rise: Date | null = null;
  let set: Date | null = null;

  for (let i = 1; i <= steps; i++) {
    const t = new Date(now.getTime() + i * stepMin * 60_000);
    const hor = horizonForStar(observer, t, { raHours, decDeg });
    const alt = hor.altitude;

    if (prevAlt != null) {
      // 从负到正 → 升起
      if (prevAlt <= 0 && alt > 0 && !rise) {
        rise = t;
      }
      // Record the next setting crossing even when the star is already above the horizon.
      if (prevAlt > 0 && alt <= 0 && !set) {
        set = t;
      }
    }
    prevAlt = alt;
    if (rise && set) break;
  }

  return { rise, set };
}

/** 检查未来 hours 小时内是否会升起（用于 rising_soon 判定） */
function willRiseSoon(
  slug: string,
  observer: Observer,
  now: Date,
  hours: number,
): boolean {
  if (planetSlugs.has(slug)) {
    const t = MakeTime(now);
    try {
      const r = SearchRiseSet(bodyBySlug[slug], observer, 1, t, hours / 24);
      if (r?.date) {
        return r.date.getTime() <= now.getTime() + hours * 3600_000;
      }
    } catch { /* fallthrough */ }
  } else {
    const c = coordinatesForSlug(slug);
    if (!c) return false;

    const stepMin = 5;
    const steps = (hours * 60) / stepMin;

    for (let i = 0; i <= steps; i++) {
      const t = new Date(now.getTime() + i * stepMin * 60_000);
      const hor = horizonForStar(observer, t, c);
      if (hor.altitude > 0) return true;
    }
  }
  return false;
}

export function computeObservation(slug: string, lat: number, lng: number, obsDate?: Date): ObservationData | null {
  const observer = new Observer(lat, lng, 0);
  const now = obsDate ?? new Date();
  const time = MakeTime(now);

  let alt: number;
  let az: number;
  let raHours: number | null = null;
  let decDeg: number | null = null;
  let bestMonths: string | null = null;

  // 1. alt/az
  if (planetSlugs.has(slug)) {
    const eq = Equator(bodyBySlug[slug], time, observer, true, true);
    const hor = Horizon(time, observer, eq.ra, eq.dec);
    alt = hor.altitude;
    az = hor.azimuth;
  } else {
    const c = coordinatesForSlug(slug);
    if (!c) return null;
    const hor = horizonForStar(observer, now, c);
    alt = hor.altitude;
    az = hor.azimuth;
    raHours = c.raHours;
    decDeg = c.decDeg;
    bestMonths = bestMonthsForStar(c, observer, now);
  }

  // 2. 状态判定 — 6 小时窗口
  let status: ObservationData["status"];
  let statusText: string;
  if (alt > 0) {
    status = "visible";
    statusText = "现在可见";
  } else if (willRiseSoon(slug, observer, now, 6)) {
    status = "rising_soon";
    statusText = "即将升起";
  } else {
    status = "not_visible";
    statusText = "当前不可见";
  }

  // 3. 升起/落下时间
  let riseTime: string | null = null;
  let setTime: string | null = null;

  if (planetSlugs.has(slug)) {
    // 行星：SearchRiseSet 分别查 rise (dir=1) 和 set (dir=-1)
    const { rise, set } = planetRiseSet(bodyBySlug[slug], observer, time, 1);
    riseTime = rise ? fmtTime(rise) : null;
    setTime = set ? fmtTime(set) : null;
  } else if (raHours != null && decDeg != null) {
    // 亮星/星座：时间扫描找 alt 过零点
    const { rise, set } = starRiseSet(raHours, decDeg, observer, now);
    riseTime = rise ? fmtTime(rise) : null;
    setTime = set ? fmtTime(set) : null;
  }

  // 4. 今晚建议
  let advice: string;
  if (status === "visible") {
    advice = alt > 30 ? "今晚很适合观测，高度理想" : "可以观测，高度偏低但仍可见";
  } else if (status === "rising_soon") {
    advice = riseTime
      ? `预计 ${riseTime} 升起，可以稍等片刻`
      : "稍等片刻就会升起，可以先找其他可见天体";
  } else {
    advice = "今晚不适合观测，建议先看其他天体";
  }

  const normalizedAzimuth = ((az % 360) + 360) % 360;
  return {
    status,
    statusText,
    direction: azToDirection(normalizedAzimuth),
    azimuth: normalizedAzimuth,
    altitude: alt,
    latitude: lat,
    longitude: lng,
    riseTime,
    setTime,
    bestMonths,
    advice,
  };
}
