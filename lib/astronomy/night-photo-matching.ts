export interface NormalizedBrightPoint {
  x: number;
  y: number;
  brightness: number;
}

export interface HorizontalSkyCandidate {
  slug: string;
  name: string;
  magnitude: number;
  azimuth: number;
  altitude: number;
}

export interface NightSkyMatch extends HorizontalSkyCandidate {
  distance: number;
  score: number;
  azimuthDelta: number;
  altitudeDelta: number;
  azimuthError: number;
  altitudeError: number;
  calibrated: boolean;
}

export interface NightSkyMatchOptions {
  calibrated?: boolean;
  estimatedAccuracy?: number;
}

export interface CameraFieldOfView {
  horizontal: number;
  vertical: number;
}

const BASE_HORIZONTAL_FOV = 72;
const AZIMUTH_SENSOR_TOLERANCE = 20;
const ALTITUDE_SENSOR_TOLERANCE = 16;
const POINT_MATCH_TOLERANCE = 22;
const CALIBRATED_BASE_SCORE_MAXIMUM = 0.9;
const SINGLE_POINT_SCORE_MAXIMUM = 0.65;

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.max(minimum, Math.min(maximum, value))
);

const toRadians = (degrees: number) => degrees * Math.PI / 180;
const toDegrees = (radians: number) => radians * 180 / Math.PI;

function signedAngleDelta(angle: number, center: number) {
  return ((angle - center + 540) % 360) - 180;
}

export function cameraFieldOfView(width: number, height: number, zoom = 1): CameraFieldOfView {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const safeZoom = Math.max(1, zoom);
  const baseHorizontalRadians = toRadians(BASE_HORIZONTAL_FOV);
  const baseVerticalRadians = 2 * Math.atan(
    Math.tan(baseHorizontalRadians / 2) * safeHeight / safeWidth,
  );

  return {
    horizontal: safeZoom === 1
      ? BASE_HORIZONTAL_FOV
      : toDegrees(2 * Math.atan(Math.tan(baseHorizontalRadians / 2) / safeZoom)),
    vertical: toDegrees(2 * Math.atan(Math.tan(baseVerticalRadians / 2) / safeZoom)),
  };
}

export function projectHorizontalToImage(
  candidate: Pick<HorizontalSkyCandidate, "azimuth" | "altitude">,
  view: { azimuth: number; pitch: number },
  fieldOfView: CameraFieldOfView,
): { x: number; y: number } | null {
  const azimuthDelta = toRadians(signedAngleDelta(candidate.azimuth, view.azimuth));
  const altitude = toRadians(candidate.altitude);
  const viewAltitude = toRadians(view.pitch);
  const forward = Math.sin(altitude) * Math.sin(viewAltitude)
    + Math.cos(altitude) * Math.cos(azimuthDelta) * Math.cos(viewAltitude);
  if (forward <= 0) return null;

  const east = Math.cos(altitude) * Math.sin(azimuthDelta);
  const up = Math.sin(altitude) * Math.cos(viewAltitude)
    - Math.cos(altitude) * Math.cos(azimuthDelta) * Math.sin(viewAltitude);
  const focalX = 0.5 / Math.tan(toRadians(fieldOfView.horizontal / 2));
  const focalY = 0.5 / Math.tan(toRadians(fieldOfView.vertical / 2));

  return {
    x: 0.5 + (east / forward) * focalX,
    y: 0.5 - (up / forward) * focalY,
  };
}

export function matchBrightPointsToSky(
  points: NormalizedBrightPoint[],
  candidates: HorizontalSkyCandidate[],
  view: { azimuth: number; pitch: number },
  image: { width: number; height: number },
  zoom = 1,
  options: NightSkyMatchOptions = {},
): NightSkyMatch[] {
  if (points.length === 0) return [];
  const fieldOfView = cameraFieldOfView(image.width, image.height, zoom);
  const calibrated = options.calibrated === true;
  const estimatedAccuracy = clamp(options.estimatedAccuracy ?? 8, 2.5, 20);
  const azimuthErrorTolerance = calibrated
    ? clamp(estimatedAccuracy * 1.5, 8, 18)
    : POINT_MATCH_TOLERANCE;
  const altitudeErrorTolerance = calibrated
    ? clamp(estimatedAccuracy * 0.8, 4, 8)
    : POINT_MATCH_TOLERANCE;
  const maximumAzimuthDelta = fieldOfView.horizontal / 2
    + (calibrated ? azimuthErrorTolerance : AZIMUTH_SENSOR_TOLERANCE);
  const maximumAltitudeDelta = fieldOfView.vertical / 2
    + (calibrated ? altitudeErrorTolerance : ALTITUDE_SENSOR_TOLERANCE);
  const imageScale = Math.max(image.width, image.height);
  const matches: NightSkyMatch[] = [];

  for (const candidate of candidates) {
    const azimuthDelta = signedAngleDelta(candidate.azimuth, view.azimuth);
    const altitudeDelta = candidate.altitude - view.pitch;
    if (Math.abs(azimuthDelta) > maximumAzimuthDelta) continue;
    if (Math.abs(altitudeDelta) > maximumAltitudeDelta) continue;

    const projected = projectHorizontalToImage(candidate, view, fieldOfView);
    if (!projected) continue;

    let nearestWeightedError = Number.POSITIVE_INFINITY;
    let nearestNormalizedDistance = Number.POSITIVE_INFINITY;
    let nearestAzimuthError = Number.POSITIVE_INFINITY;
    let nearestAltitudeError = Number.POSITIVE_INFINITY;
    for (const point of points) {
      const deltaX = point.x - projected.x;
      const deltaY = point.y - projected.y;
      const azimuthError = Math.abs(deltaX * fieldOfView.horizontal);
      const altitudeError = Math.abs(deltaY * fieldOfView.vertical);
      const weightedError = Math.hypot(
        azimuthError / azimuthErrorTolerance,
        altitudeError / altitudeErrorTolerance,
      );
      if (weightedError < nearestWeightedError) {
        nearestWeightedError = weightedError;
        nearestNormalizedDistance = Math.hypot(deltaX, deltaY);
        nearestAzimuthError = azimuthError;
        nearestAltitudeError = altitudeError;
      }
    }
    if (nearestAzimuthError > azimuthErrorTolerance) continue;
    if (nearestAltitudeError > altitudeErrorTolerance) continue;

    const magnitudeScore = Math.max(0, Math.min(1, (4 - candidate.magnitude) / 4));
    let score: number;
    if (calibrated) {
      const azimuthSigma = azimuthErrorTolerance / 2;
      const altitudeSigma = altitudeErrorTolerance / 2;
      const azimuthScore = Math.exp(-0.5 * (nearestAzimuthError / azimuthSigma) ** 2);
      const altitudeScore = Math.exp(-0.5 * (nearestAltitudeError / altitudeSigma) ** 2);
      const pointScore = Math.exp(-0.5 * nearestWeightedError ** 2);
      score = pointScore * 0.35
        + altitudeScore * 0.3
        + azimuthScore * 0.2
        + magnitudeScore * 0.05;
      if (points.length === 1) {
        score *= SINGLE_POINT_SCORE_MAXIMUM / CALIBRATED_BASE_SCORE_MAXIMUM;
      }
    } else {
      const nearestAngularError = Math.hypot(nearestAzimuthError, nearestAltitudeError);
      const pointScore = Math.max(0, 1 - nearestAngularError / POINT_MATCH_TOLERANCE);
      const directionScore = Math.max(0, 1 - Math.hypot(
        azimuthDelta / maximumAzimuthDelta,
        altitudeDelta / maximumAltitudeDelta,
      ) / Math.SQRT2);
      score = pointScore * 0.65 + directionScore * 0.25 + magnitudeScore * 0.1;
    }

    matches.push({
      ...candidate,
      distance: nearestNormalizedDistance * imageScale,
      score,
      azimuthDelta,
      altitudeDelta,
      azimuthError: nearestAzimuthError,
      altitudeError: nearestAltitudeError,
      calibrated,
    });
  }

  return matches
    .sort((first, second) => second.score - first.score
      || first.altitudeError - second.altitudeError
      || first.azimuthError - second.azimuthError
      || first.magnitude - second.magnitude
      || first.slug.localeCompare(second.slug))
    .slice(0, 5);
}
