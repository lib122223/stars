import { Body, Equator, Horizon, Illumination, MakeTime, Observer } from "astronomy-engine";
import { activeBrightStars } from "./bright-stars";
import { stellarEquatorOfDate } from "./stellar-coordinates";

export type SkyObjectType = "bright_star" | "planet" | "moon";
export type VisibilityLevel = "easy" | "possible" | "challenging";

export interface VisibleSkyObject {
  slug: string;
  name: string;
  type: SkyObjectType;
  altitude: number;
  azimuth: number;
  direction: string;
  magnitude: number;
  effectiveMagnitude: number;
  visibility: VisibilityLevel;
  visibilityLabel: string;
}

export interface SkyVisibilityResult {
  observationTime: string;
  limitingMagnitude: number;
  moonIllumination: number;
  moonAltitude: number;
  objects: VisibleSkyObject[];
  recommended: VisibleSkyObject[];
}

interface VisibilityInput {
  location: { lat: number; lng: number };
  observationTime: Date;
  conditionScore: number;
  darknessScore: number;
}

interface LimitingMagnitudeInput {
  conditionScore: number;
  darknessScore: number;
  moonIllumination: number;
  moonAltitude: number;
}

interface SolarSystemTarget {
  slug: string;
  name: string;
  type: SkyObjectType;
  body: Body;
}

const TILE_SIZE = 256;

const solarSystemTargets: SolarSystemTarget[] = [
  { slug: "mercury", name: "水星", type: "planet", body: Body.Mercury },
  { slug: "venus", name: "金星", type: "planet", body: Body.Venus },
  { slug: "mars", name: "火星", type: "planet", body: Body.Mars },
  { slug: "jupiter", name: "木星", type: "planet", body: Body.Jupiter },
  { slug: "saturn", name: "土星", type: "planet", body: Body.Saturn },
  { slug: "uranus", name: "天王星", type: "planet", body: Body.Uranus },
  { slug: "moon", name: "月球", type: "moon", body: Body.Moon },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function nightLightTileAt(lat: number, lng: number, zoom: number) {
  const clampedLat = clamp(lat, -85.05112878, 85.05112878);
  const scale = 2 ** zoom;
  const tileX = ((lng + 180) / 360) * scale;
  const latRad = clampedLat * Math.PI / 180;
  const tileY = (1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * scale;
  const x = Math.floor(tileX);
  const y = Math.floor(tileY);

  return {
    x,
    y,
    pixelX: Math.floor((tileX - x) * TILE_SIZE),
    pixelY: Math.floor((tileY - y) * TILE_SIZE),
  };
}

export function estimateLimitingMagnitude(input: LimitingMagnitudeInput): number {
  const darknessBase = 3.2 + clamp(input.darknessScore, 0, 100) * 0.033;
  const weatherAdjustment = (clamp(input.conditionScore, 0, 100) - 70) * 0.025;
  const moonHeight = clamp(input.moonAltitude, 0, 90) / 90;
  const moonPenalty = input.moonAltitude > 0
    ? clamp(input.moonIllumination, 0, 1) * (0.45 + moonHeight * 0.95)
    : 0;

  return Number(clamp(darknessBase + weatherAdjustment - moonPenalty, 1.5, 6.7).toFixed(2));
}

function atmosphericExtinction(altitude: number): number {
  const safeAltitude = clamp(altitude, 5, 90);
  const airmass = 1 / (
    Math.sin(safeAltitude * Math.PI / 180)
    + 0.50572 * (safeAltitude + 6.07995) ** -1.6364
  );
  return clamp(0.18 * (airmass - 1), 0, 2.5);
}

function directionFromAzimuth(azimuth: number): string {
  const directions = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
  const normalized = ((azimuth % 360) + 360) % 360;
  return directions[Math.round(normalized / 45) % directions.length];
}

function visibilityLevel(margin: number): Pick<VisibleSkyObject, "visibility" | "visibilityLabel"> {
  if (margin >= 1.5) return { visibility: "easy", visibilityLabel: "容易看见" };
  if (margin >= 0.45) return { visibility: "possible", visibilityLabel: "适应黑暗后可见" };
  return { visibility: "challenging", visibilityLabel: "接近肉眼极限" };
}

function rankObject(object: VisibleSkyObject, limitingMagnitude: number): number {
  const margin = clamp(limitingMagnitude - object.effectiveMagnitude, 0, 4);
  const altitudeScore = clamp(object.altitude, 0, 60) / 60;
  const recognizability = object.type === "moon" ? 0.9 : object.type === "planet" ? 0.75 : 0.5;
  return margin * 12 + altitudeScore * 35 + recognizability * 10;
}

function makeVisibleObject(
  target: Omit<VisibleSkyObject, "direction" | "effectiveMagnitude" | "visibility" | "visibilityLabel">,
  limitingMagnitude: number,
): VisibleSkyObject | null {
  if (target.altitude < 5) return null;
  const effectiveMagnitude = target.magnitude + atmosphericExtinction(target.altitude);
  const margin = limitingMagnitude - effectiveMagnitude;
  if (margin < 0) return null;

  return {
    ...target,
    direction: directionFromAzimuth(target.azimuth),
    effectiveMagnitude: Number(effectiveMagnitude.toFixed(2)),
    ...visibilityLevel(margin),
  };
}

export function computeSkyVisibility(input: VisibilityInput): SkyVisibilityResult {
  const observer = new Observer(input.location.lat, input.location.lng, 0);
  const time = MakeTime(input.observationTime);
  const moonEq = Equator(Body.Moon, time, observer, true, true);
  const moonHorizon = Horizon(time, observer, moonEq.ra, moonEq.dec);
  const moonIllumination = Illumination(Body.Moon, time).phase_fraction;
  const limitingMagnitude = estimateLimitingMagnitude({
    conditionScore: input.conditionScore,
    darknessScore: input.darknessScore,
    moonIllumination,
    moonAltitude: moonHorizon.altitude,
  });
  const objects: VisibleSkyObject[] = [];

  for (const target of solarSystemTargets) {
    const eq = Equator(target.body, time, observer, true, true);
    const horizon = Horizon(time, observer, eq.ra, eq.dec);
    const magnitude = Illumination(target.body, time).mag;
    const object = makeVisibleObject({
      slug: target.slug,
      name: target.name,
      type: target.type,
      altitude: horizon.altitude,
      azimuth: horizon.azimuth,
      magnitude,
    }, limitingMagnitude);
    if (object) objects.push(object);
  }

  for (const star of activeBrightStars()) {
    const eq = stellarEquatorOfDate(star.raHours, star.decDeg, input.observationTime);
    const horizon = Horizon(time, observer, eq.ra, eq.dec);
    const object = makeVisibleObject({
      slug: star.slug,
      name: star.nameZh,
      type: "bright_star",
      altitude: horizon.altitude,
      azimuth: horizon.azimuth,
      magnitude: star.magnitude,
    }, limitingMagnitude);
    if (object) objects.push(object);
  }

  objects.sort((a, b) => rankObject(b, limitingMagnitude) - rankObject(a, limitingMagnitude));

  return {
    observationTime: input.observationTime.toISOString(),
    limitingMagnitude,
    moonIllumination: Number(moonIllumination.toFixed(3)),
    moonAltitude: Number(moonHorizon.altitude.toFixed(1)),
    objects,
    recommended: objects.slice(0, 4),
  };
}
