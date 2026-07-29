import { Body, Equator, Horizon, MakeTime, Observer } from "astronomy-engine";
import { computeSkyVisibility, type SkyVisibilityResult } from "./astronomy/sky-visibility";
import {
  fetchLightPollutionEstimate,
  unavailableLightPollution,
  type LightPollutionEstimate,
} from "./night-light";
import { fetchSiteConditions, type SiteConditions } from "./site-conditions";

export interface ObservationSnapshot extends SiteConditions {
  lightPollution: LightPollutionEstimate;
  visibleSky: SkyVisibilityResult;
}

function sunAltitude(date: Date, lat: number, lng: number): number {
  const time = MakeTime(date);
  const observer = new Observer(lat, lng, 0);
  const eq = Equator(Body.Sun, time, observer, true, true);
  return Horizon(time, observer, eq.ra, eq.dec).altitude;
}

function observationTime(now: Date, conditions: SiteConditions, lat: number, lng: number): Date {
  if (sunAltitude(now, lat, lng) <= -6) return now;
  const bestTime = conditions.days[0]?.star.bestTimeIso;
  if (!bestTime) return now;
  const parsed = new Date(bestTime);
  return Number.isNaN(parsed.getTime()) ? now : parsed;
}

export async function fetchObservationSnapshot(
  lat: number,
  lng: number,
  now = new Date(),
): Promise<ObservationSnapshot> {
  const [conditions, lightPollution] = await Promise.all([
    fetchSiteConditions(lat, lng),
    fetchLightPollutionEstimate(lat, lng).catch(() => unavailableLightPollution()),
  ]);
  const referenceTime = observationTime(now, conditions, lat, lng);
  const visibleSky = computeSkyVisibility({
    location: { lat, lng },
    observationTime: referenceTime,
    conditionScore: conditions.days[0]?.star.score ?? 50,
    darknessScore: lightPollution.darknessScore,
  });

  return {
    ...conditions,
    lightPollution,
    visibleSky,
  };
}
