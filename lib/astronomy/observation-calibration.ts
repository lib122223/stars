import { Body, Equator, Horizon, MakeTime, Observer } from "astronomy-engine";
import { findBrightStar } from "@/lib/astronomy/bright-stars";
import { stellarEquatorOfDate } from "@/lib/astronomy/stellar-coordinates";

export interface ObservationPose {
  azimuth: number;
  pitch: number;
  gamma: number;
}

export interface CalibrationReference {
  slug: string;
  name: string;
  azimuth: number;
  altitude: number;
  kind: "moon" | "planet" | "bright_star";
}

export interface ObservationCalibration {
  azimuthOffset: number;
  pitchOffset: number;
  sensorJitter: number;
  estimatedAccuracy: number;
  referenceSlug: string;
  referenceName: string;
  latitude: number;
  longitude: number;
  calibratedAt: string;
  expiresAt: string;
  mode?: "basic" | "refined";
  pointCount?: number;
  verificationError?: number;
  referenceNames?: string[];
}

interface ComputeCalibrationInput {
  reference: CalibrationReference;
  samples: ObservationPose[];
  location: { lat: number; lng: number };
  calibratedAt?: Date;
}

const CALIBRATION_VALID_MS = 6 * 60 * 60 * 1000;
const CALIBRATION_MAX_DISTANCE_KM = 20;
const AZIMUTH_VERIFICATION_LIMIT = 10;
const ALTITUDE_VERIFICATION_LIMIT = 6;

export function normalizeObservationAngle(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function signedObservationAngleDelta(value: number, center: number): number {
  return ((value - center + 540) % 360) - 180;
}

function circularMean(values: number[]): number {
  const sum = values.reduce((result, value) => ({
    sin: result.sin + Math.sin(value * Math.PI / 180),
    cos: result.cos + Math.cos(value * Math.PI / 180),
  }), { sin: 0, cos: 0 });
  return normalizeObservationAngle(Math.atan2(sum.sin, sum.cos) * 180 / Math.PI);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function signedCircularMean(values: number[]): number {
  return signedObservationAngleDelta(circularMean(values), 0);
}

export function computeObservationCalibration({
  reference,
  samples,
  location,
  calibratedAt = new Date(),
}: ComputeCalibrationInput): ObservationCalibration {
  if (samples.length === 0) throw new Error("Calibration requires at least one pose sample");
  const measuredAzimuth = circularMean(samples.map((sample) => sample.azimuth));
  const measuredPitch = median(samples.map((sample) => sample.pitch));
  const squaredError = samples.reduce((sum, sample) => {
    const azError = signedObservationAngleDelta(sample.azimuth, measuredAzimuth);
    const pitchError = sample.pitch - measuredPitch;
    return sum + azError * azError + pitchError * pitchError;
  }, 0) / samples.length;
  const sensorJitter = Math.sqrt(squaredError);
  const estimatedAccuracy = Math.max(2.5, Math.min(20, 2.5 + sensorJitter * 1.5));

  return {
    azimuthOffset: signedObservationAngleDelta(reference.azimuth, measuredAzimuth),
    pitchOffset: reference.altitude - measuredPitch,
    sensorJitter,
    estimatedAccuracy,
    referenceSlug: reference.slug,
    referenceName: reference.name,
    latitude: location.lat,
    longitude: location.lng,
    calibratedAt: calibratedAt.toISOString(),
    expiresAt: new Date(calibratedAt.getTime() + CALIBRATION_VALID_MS).toISOString(),
    mode: "basic",
    pointCount: 1,
    verificationError: 0,
    referenceNames: [reference.name],
  };
}

export interface CalibrationVerification {
  accepted: boolean;
  azimuthError: number;
  altitudeError: number;
  verificationError: number;
}

export function verifyObservationCalibrations(
  first: ObservationCalibration,
  second: ObservationCalibration,
): CalibrationVerification {
  const azimuthError = Math.abs(signedObservationAngleDelta(
    second.azimuthOffset,
    first.azimuthOffset,
  ));
  const altitudeError = Math.abs(second.pitchOffset - first.pitchOffset);
  const verificationError = Math.sqrt(azimuthError ** 2 + altitudeError ** 2);

  return {
    accepted: azimuthError <= AZIMUTH_VERIFICATION_LIMIT
      && altitudeError <= ALTITUDE_VERIFICATION_LIMIT,
    azimuthError,
    altitudeError,
    verificationError,
  };
}

export function refineObservationCalibration(
  first: ObservationCalibration,
  second: ObservationCalibration,
): ObservationCalibration | null {
  const verification = verifyObservationCalibrations(first, second);
  if (!verification.accepted) return null;

  const referenceNames = [
    ...(first.referenceNames ?? [first.referenceName]),
    ...(second.referenceNames ?? [second.referenceName]),
  ].filter((name, index, names) => names.indexOf(name) === index);

  return {
    ...first,
    azimuthOffset: signedCircularMean([first.azimuthOffset, second.azimuthOffset]),
    pitchOffset: (first.pitchOffset + second.pitchOffset) / 2,
    sensorJitter: Math.max(first.sensorJitter, second.sensorJitter),
    estimatedAccuracy: Math.max(
      2.5,
      Math.min(20, Math.max(first.estimatedAccuracy, second.estimatedAccuracy, verification.verificationError / 2)),
    ),
    mode: "refined",
    pointCount: 2,
    verificationError: verification.verificationError,
    referenceNames,
  };
}

export function applyObservationCalibration(
  pose: ObservationPose,
  calibration: ObservationCalibration | null,
): ObservationPose {
  if (!calibration) return pose;
  return {
    azimuth: normalizeObservationAngle(pose.azimuth + calibration.azimuthOffset),
    pitch: Math.max(-90, Math.min(90, pose.pitch + calibration.pitchOffset)),
    gamma: pose.gamma,
  };
}

function locationDistanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const earthRadiusKm = 6371;
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;
  const deltaLat = (to.lat - from.lat) * Math.PI / 180;
  const deltaLng = (to.lng - from.lng) * Math.PI / 180;
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function isObservationCalibrationValid(
  calibration: ObservationCalibration,
  now: Date,
  location: { lat: number; lng: number },
): boolean {
  const calibratedAt = new Date(calibration.calibratedAt).getTime();
  const expiresAt = new Date(calibration.expiresAt).getTime();
  if (!Number.isFinite(calibratedAt) || !Number.isFinite(expiresAt)) return false;
  if (now.getTime() < calibratedAt || now.getTime() > expiresAt) return false;
  return locationDistanceKm(
    { lat: calibration.latitude, lng: calibration.longitude },
    location,
  ) <= CALIBRATION_MAX_DISTANCE_KM;
}

const brightReferenceSlugs = ["sirius", "vega", "arcturus", "capella", "rigel", "betelgeuse"];

function skySeparation(left: Pick<CalibrationReference, "azimuth" | "altitude">, right: Pick<CalibrationReference, "azimuth" | "altitude">): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const altitudeLeft = toRadians(left.altitude);
  const altitudeRight = toRadians(right.altitude);
  const azimuthDelta = toRadians(signedObservationAngleDelta(left.azimuth, right.azimuth));
  const cosine = Math.sin(altitudeLeft) * Math.sin(altitudeRight)
    + Math.cos(altitudeLeft) * Math.cos(altitudeRight) * Math.cos(azimuthDelta);
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}

export function buildSecondCalibrationReferences(
  references: CalibrationReference[],
  first: CalibrationReference,
): CalibrationReference[] {
  return references
    .filter((reference) => reference.slug !== first.slug && reference.altitude >= 15)
    .map((reference) => ({
      reference,
      separation: skySeparation(first, reference),
      brightnessRank: reference.kind === "moon" ? 0 : reference.kind === "planet" ? 1 : 2,
    }))
    .filter(({ separation }) => separation >= 45)
    .sort((left, right) => (
      left.brightnessRank - right.brightnessRank
      || Math.abs(left.separation - 60) - Math.abs(right.separation - 60)
      || right.reference.altitude - left.reference.altitude
    ))
    .map(({ reference }) => reference);
}

export function buildCalibrationReferences(
  time: Date,
  location: { lat: number; lng: number },
): CalibrationReference[] {
  const astroTime = MakeTime(time);
  const observer = new Observer(location.lat, location.lng, 0);
  const references: Array<CalibrationReference & { priority: number }> = [];
  const bodies = [
    { body: Body.Moon, slug: "moon", name: "月球", kind: "moon" as const, priority: 0 },
    { body: Body.Venus, slug: "venus", name: "金星", kind: "planet" as const, priority: 1 },
    { body: Body.Jupiter, slug: "jupiter", name: "木星", kind: "planet" as const, priority: 2 },
  ];

  for (const item of bodies) {
    try {
      const equator = Equator(item.body, astroTime, observer, true, true);
      const horizon = Horizon(astroTime, observer, equator.ra, equator.dec);
      if (horizon.altitude >= 8) {
        references.push({
          slug: item.slug,
          name: item.name,
          azimuth: horizon.azimuth,
          altitude: horizon.altitude,
          kind: item.kind,
          priority: item.priority,
        });
      }
    } catch {
      // Keep other reference candidates available when one body cannot be resolved.
    }
  }

  brightReferenceSlugs.forEach((slug, index) => {
    const star = findBrightStar(slug);
    if (!star) return;
    try {
      const equator = stellarEquatorOfDate(star.raHours, star.decDeg, time);
      const horizon = Horizon(astroTime, observer, equator.ra, equator.dec);
      if (horizon.altitude >= 10) {
        references.push({
          slug: star.slug,
          name: star.nameZh,
          azimuth: horizon.azimuth,
          altitude: horizon.altitude,
          kind: "bright_star",
          priority: 10 + index,
        });
      }
    } catch {
      // Ignore a failed optional star and keep the remaining references.
    }
  });

  return references
    .sort((left, right) => left.priority - right.priority || right.altitude - left.altitude)
    .map(({ priority: _priority, ...reference }) => reference);
}
