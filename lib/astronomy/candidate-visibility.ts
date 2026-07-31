export type CandidateVisibility = "visible" | "low" | "impossible";

const HORIZON_TOLERANCE_DEG = -1;
const LOW_ALTITUDE_LIMIT_DEG = 8;
export const NEAR_CANDIDATE_SEPARATION_DEG = 2.5;

export interface HorizontalCoordinate {
  azimuth: number;
  altitude: number;
}

export function assessCandidateVisibility(altitude: number): CandidateVisibility {
  if (!Number.isFinite(altitude) || altitude < HORIZON_TOLERANCE_DEG) return "impossible";
  if (altitude < LOW_ALTITUDE_LIMIT_DEG) return "low";
  return "visible";
}

export function isCandidatePossible(altitude: number): boolean {
  return assessCandidateVisibility(altitude) !== "impossible";
}

export function candidateVisibilityScore(altitude: number): number {
  const visibility = assessCandidateVisibility(altitude);
  if (visibility === "impossible") return 0;
  if (visibility === "low") return 0.35 + Math.max(0, altitude + 1) / (LOW_ALTITUDE_LIMIT_DEG + 1) * 0.45;
  return 1;
}

export function angularSeparationDegrees(
  first: HorizontalCoordinate,
  second: HorizontalCoordinate,
): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const firstAltitude = toRadians(first.altitude);
  const secondAltitude = toRadians(second.altitude);
  const azimuthDelta = toRadians(first.azimuth - second.azimuth);
  const cosine = Math.sin(firstAltitude) * Math.sin(secondAltitude)
    + Math.cos(firstAltitude) * Math.cos(secondAltitude) * Math.cos(azimuthDelta);

  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}

export function areCandidatesTooClose(
  first: HorizontalCoordinate,
  second: HorizontalCoordinate,
  maximumSeparation = NEAR_CANDIDATE_SEPARATION_DEG,
): boolean {
  return angularSeparationDegrees(first, second) <= maximumSeparation;
}
