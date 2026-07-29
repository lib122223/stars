import { Body, Equator, Horizon, Observer } from "astronomy-engine";
import {
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  gstime,
  invjday,
  jday,
  propagate,
  radiansToDegrees,
  shadowFraction,
  sunPos,
  twoline2satrec,
  type GeodeticLocation,
} from "satellite.js";
import { fetchCloudCoverForecast, type CloudForecastPoint } from "@/lib/weather";

const ISS_TLE_URL = "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE";
const TLE_CACHE_MS = 6 * 60 * 60 * 1000;
const PASS_WINDOW_MS = 24 * 60 * 60 * 1000;
const SAMPLE_STEP_MS = 20 * 1000;
const MIN_ELEVATION_DEG = 10;

interface CachedTle {
  name: string;
  line1: string;
  line2: string;
  fetchedAt: number;
}

interface PassSample {
  time: Date;
  elevation: number;
  azimuth: number;
  rangeKm: number;
  shadow: number;
}

export type SatelliteVisibilityLevel = "easy" | "possible" | "difficult";

export interface SatellitePassPoint {
  time: string;
  azimuth: number;
  elevation: number;
  direction: string;
}

export interface SatellitePass {
  id: string;
  start: SatellitePassPoint;
  peak: SatellitePassPoint & { elevation: number; rangeKm: number };
  end: SatellitePassPoint;
  durationMinutes: number;
  illuminatedDuringPass: boolean;
  observerSunAltitude: number;
  cloudCover: number | null;
  visibility: {
    level: SatelliteVisibilityLevel;
    label: string;
    reason: string;
  };
}

export interface SatellitePassForecast {
  satellite: { name: string; noradId: 25544 };
  generatedAt: string;
  tleEpoch: string;
  window: { start: string; end: string; hours: 24 };
  passes: SatellitePass[];
}

let tleCache: CachedTle | null = null;

function parseTle(text: string): Omit<CachedTle, "fetchedAt"> {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const line1 = lines.find((line) => line.startsWith("1 "));
  const line2 = lines.find((line) => line.startsWith("2 "));
  if (!line1 || !line2) throw new Error("ISS TLE response is invalid");
  return { name: lines[0]?.startsWith("ISS") ? lines[0] : "ISS (ZARYA)", line1, line2 };
}

async function getIssTle(): Promise<CachedTle> {
  const now = Date.now();
  if (tleCache && now - tleCache.fetchedAt < TLE_CACHE_MS) return tleCache;

  try {
    const response = await fetch(ISS_TLE_URL, {
      headers: { Accept: "text/plain" },
      next: { revalidate: 21600 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`CelesTrak returned ${response.status}`);
    tleCache = { ...parseTle(await response.text()), fetchedAt: now };
    return tleCache;
  } catch (error) {
    if (tleCache) return tleCache;
    throw error;
  }
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function directionForAzimuth(azimuth: number): string {
  const directions = [
    "北", "北偏东", "东北", "东偏北",
    "东", "东偏南", "东南", "南偏东",
    "南", "南偏西", "西南", "西偏南",
    "西", "西偏北", "西北", "北偏西",
  ];
  return directions[Math.round(normalizeDegrees(azimuth) / 22.5) % 16];
}

function sunAltitudeAt(time: Date, observer: Observer): number {
  const equatorial = Equator(Body.Sun, time, observer, true, true);
  return Horizon(time, observer, equatorial.ra, equatorial.dec).altitude;
}

function nearestCloudCover(points: CloudForecastPoint[], time: Date): number | null {
  let closest: CloudForecastPoint | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const distance = Math.abs(new Date(point.time).getTime() - time.getTime());
    if (distance < closestDistance) {
      closest = point;
      closestDistance = distance;
    }
  }
  return closest && closestDistance <= 90 * 60 * 1000 ? closest.cloudCover : null;
}

function visibilityForPass(
  bestObservableElevation: number | null,
  illuminatedDuringPass: boolean,
  observerSunAltitude: number,
  cloudCover: number | null,
): SatellitePass["visibility"] {
  if (!illuminatedDuringPass) {
    return { level: "difficult", label: "较难看见", reason: "ISS 本次过境处于地影中，不会反射阳光。" };
  }
  if (bestObservableElevation == null || observerSunAltitude > -4) {
    return { level: "difficult", label: "较难看见", reason: "过境时天空背景较亮，ISS 与天空的反差不足。" };
  }
  if (cloudCover != null && cloudCover > 70) {
    return { level: "difficult", label: "较难看见", reason: `预计云量 ${cloudCover}%，云层很可能遮挡 ISS。` };
  }
  if (bestObservableElevation >= 40 && cloudCover != null && cloudCover <= 40) {
    return {
      level: "easy",
      label: "容易看见",
      reason: `ISS 受阳光照亮，最高可观测仰角 ${Math.round(bestObservableElevation)}°，预计云量 ${cloudCover}%。`,
    };
  }
  if (bestObservableElevation >= 20 && (cloudCover == null || cloudCover <= 70)) {
    return {
      level: "possible",
      label: "有机会看见",
      reason: cloudCover == null
        ? `ISS 受阳光照亮，最高可观测仰角 ${Math.round(bestObservableElevation)}°；天气数据暂不可用。`
        : `ISS 受阳光照亮，最高可观测仰角 ${Math.round(bestObservableElevation)}°，预计云量 ${cloudCover}%。`,
    };
  }
  return {
    level: "difficult",
    label: "较难看见",
    reason: `ISS 虽然受光，但可观测仰角最高约 ${Math.round(bestObservableElevation)}°，位置较贴近地平线。`,
  };
}

function pointFromSample(sample: PassSample): SatellitePassPoint {
  const azimuth = Math.round(sample.azimuth * 10) / 10;
  return {
    time: sample.time.toISOString(),
    azimuth,
    elevation: Math.round(sample.elevation * 10) / 10,
    direction: directionForAzimuth(azimuth),
  };
}

function buildPass(
  samples: PassSample[],
  observer: Observer,
  cloudForecast: CloudForecastPoint[],
): SatellitePass {
  const start = samples[0];
  const end = samples[samples.length - 1];
  const peak = samples.reduce((best, sample) => sample.elevation > best.elevation ? sample : best);
  const illuminatedSamples = samples.filter((sample) => sample.shadow < 0.95);
  const observableSamples = illuminatedSamples
    .map((sample) => ({ sample, sunAltitude: sunAltitudeAt(sample.time, observer) }))
    .filter(({ sunAltitude }) => sunAltitude <= -4);
  const bestObservable = observableSamples.reduce<(typeof observableSamples)[number] | null>(
    (best, current) => !best || current.sample.elevation > best.sample.elevation ? current : best,
    null,
  );
  const assessmentTime = bestObservable?.sample.time ?? peak.time;
  const observerSunAltitude = bestObservable?.sunAltitude ?? sunAltitudeAt(peak.time, observer);
  const cloudCover = nearestCloudCover(cloudForecast, assessmentTime);
  const visibility = visibilityForPass(
    bestObservable?.sample.elevation ?? null,
    illuminatedSamples.length > 0,
    observerSunAltitude,
    cloudCover,
  );

  return {
    id: start.time.toISOString(),
    start: pointFromSample(start),
    peak: {
      ...pointFromSample(peak),
      elevation: Math.round(peak.elevation * 10) / 10,
      rangeKm: Math.round(peak.rangeKm),
    },
    end: pointFromSample(end),
    durationMinutes: Math.max(1, Math.round((end.time.getTime() - start.time.getTime()) / 60_000)),
    illuminatedDuringPass: illuminatedSamples.length > 0,
    observerSunAltitude: Math.round(observerSunAltitude * 10) / 10,
    cloudCover,
    visibility,
  };
}

export async function predictIssPasses(
  latitude: number,
  longitude: number,
  startTime = new Date(),
): Promise<SatellitePassForecast> {
  const [{ name, line1, line2 }, cloudForecast] = await Promise.all([
    getIssTle(),
    fetchCloudCoverForecast(latitude, longitude, 30),
  ]);
  const satrec = twoline2satrec(line1, line2);
  const observerGeodetic: GeodeticLocation = {
    latitude: degreesToRadians(latitude),
    longitude: degreesToRadians(longitude),
    height: 0,
  };
  const observer = new Observer(latitude, longitude, 0);
  const endTime = new Date(startTime.getTime() + PASS_WINDOW_MS);
  const sampleGroups: PassSample[][] = [];
  let currentPass: PassSample[] | null = null;

  for (let timestamp = startTime.getTime(); timestamp <= endTime.getTime(); timestamp += SAMPLE_STEP_MS) {
    const time = new Date(timestamp);
    const state = propagate(satrec, time);
    if (!state) continue;
    const gmst = gstime(time);
    const lookAngles = ecfToLookAngles(observerGeodetic, eciToEcf(state.position, gmst));
    const elevation = radiansToDegrees(lookAngles.elevation);

    if (elevation >= MIN_ELEVATION_DEG) {
      const sample: PassSample = {
        time,
        elevation,
        azimuth: normalizeDegrees(radiansToDegrees(lookAngles.azimuth)),
        rangeKm: lookAngles.rangeSat,
        shadow: shadowFraction(sunPos(jday(time)).rsun, state.position),
      };
      if (!currentPass) currentPass = [];
      currentPass.push(sample);
    } else if (currentPass?.length) {
      sampleGroups.push(currentPass);
      currentPass = null;
    }
  }
  if (currentPass?.length) sampleGroups.push(currentPass);

  return {
    satellite: { name: name.replace(/^0\s+/, ""), noradId: 25544 },
    generatedAt: new Date().toISOString(),
    tleEpoch: invjday(satrec.jdsatepoch).toISOString(),
    window: { start: startTime.toISOString(), end: endTime.toISOString(), hours: 24 },
    passes: sampleGroups.map((samples) => buildPass(samples, observer, cloudForecast)),
  };
}
