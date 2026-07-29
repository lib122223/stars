import assert from "node:assert/strict";
import test from "node:test";
import {
  applyObservationCalibration,
  buildSecondCalibrationReferences,
  computeObservationCalibration,
  isObservationCalibrationValid,
  refineObservationCalibration,
  verifyObservationCalibrations,
} from "../../lib/astronomy/observation-calibration";

test("single-point calibration corrects azimuth across the 0 degree boundary", () => {
  const calibration = computeObservationCalibration({
    reference: { slug: "moon", name: "月球", azimuth: 4, altitude: 22, kind: "moon" },
    samples: [
      { azimuth: 355, pitch: 18, gamma: 0 },
      { azimuth: 356, pitch: 18.2, gamma: 0 },
      { azimuth: 355.5, pitch: 17.9, gamma: 0 },
    ],
    location: { lat: 27.85, lng: 121.16 },
    calibratedAt: new Date("2026-07-28T12:00:00Z"),
  });

  assert.ok(calibration.azimuthOffset > 8 && calibration.azimuthOffset < 9);
  assert.ok(calibration.pitchOffset > 3.9 && calibration.pitchOffset < 4.1);

  const corrected = applyObservationCalibration(
    { azimuth: 355.5, pitch: 18, gamma: 6 },
    calibration,
  );
  assert.ok(corrected.azimuth < 5);
  assert.equal(corrected.pitch, 22);
  assert.equal(corrected.gamma, 6);
});

test("calibration uses the median pitch and reports sensor instability", () => {
  const stable = computeObservationCalibration({
    reference: { slug: "vega", name: "织女星", azimuth: 300, altitude: 48, kind: "bright_star" },
    samples: [
      { azimuth: 292, pitch: 44, gamma: 0 },
      { azimuth: 292.2, pitch: 44.1, gamma: 0 },
      { azimuth: 291.9, pitch: 44, gamma: 0 },
    ],
    location: { lat: 27.85, lng: 121.16 },
    calibratedAt: new Date("2026-07-28T12:00:00Z"),
  });
  const unstable = computeObservationCalibration({
    reference: { slug: "vega", name: "织女星", azimuth: 300, altitude: 48, kind: "bright_star" },
    samples: [
      { azimuth: 280, pitch: 35, gamma: 0 },
      { azimuth: 305, pitch: 52, gamma: 0 },
      { azimuth: 291, pitch: 43, gamma: 0 },
    ],
    location: { lat: 27.85, lng: 121.16 },
    calibratedAt: new Date("2026-07-28T12:00:00Z"),
  });

  assert.ok(stable.estimatedAccuracy < unstable.estimatedAccuracy);
  assert.ok(stable.sensorJitter < 1);
  assert.ok(unstable.sensorJitter > 10);
});

test("calibration expires after six hours or moving more than twenty kilometers", () => {
  const calibration = computeObservationCalibration({
    reference: { slug: "moon", name: "月球", azimuth: 210, altitude: 35, kind: "moon" },
    samples: [{ azimuth: 200, pitch: 30, gamma: 0 }],
    location: { lat: 27.85, lng: 121.16 },
    calibratedAt: new Date("2026-07-28T12:00:00Z"),
  });

  assert.equal(isObservationCalibrationValid(
    calibration,
    new Date("2026-07-28T17:59:00Z"),
    { lat: 27.86, lng: 121.17 },
  ), true);
  assert.equal(isObservationCalibrationValid(
    calibration,
    new Date("2026-07-28T18:01:00Z"),
    { lat: 27.86, lng: 121.17 },
  ), false);
  assert.equal(isObservationCalibrationValid(
    calibration,
    new Date("2026-07-28T13:00:00Z"),
    { lat: 28.15, lng: 121.16 },
  ), false);
});

test("two calibration points with a large sky separation refine one global offset", () => {
  const first = computeObservationCalibration({
    reference: { slug: "moon", name: "月球", azimuth: 40, altitude: 35, kind: "moon" },
    samples: [{ azimuth: 32, pitch: 30, gamma: 0 }],
    location: { lat: 27.85, lng: 121.16 },
    calibratedAt: new Date("2026-07-28T12:00:00Z"),
  });
  const second = computeObservationCalibration({
    reference: { slug: "vega", name: "织女星", azimuth: 160, altitude: 48, kind: "bright_star" },
    samples: [{ azimuth: 152.5, pitch: 43.5, gamma: 0 }],
    location: { lat: 27.85, lng: 121.16 },
    calibratedAt: new Date("2026-07-28T12:00:00Z"),
  });

  const verification = verifyObservationCalibrations(first, second);
  assert.equal(verification.accepted, true);
  assert.ok(verification.azimuthError < 1);
  assert.ok(verification.altitudeError < 1);

  const refined = refineObservationCalibration(first, second);
  assert.equal(refined?.mode, "refined");
  assert.equal(refined?.pointCount, 2);
  assert.deepEqual(refined?.referenceNames, ["月球", "织女星"]);
  assert.ok(Math.abs(refined!.azimuthOffset - 7.75) < 0.01);
  assert.ok(Math.abs(refined!.pitchOffset - 4.75) < 0.01);
});

test("inconsistent second point does not replace a valid basic calibration", () => {
  const first = computeObservationCalibration({
    reference: { slug: "moon", name: "月球", azimuth: 40, altitude: 35, kind: "moon" },
    samples: [{ azimuth: 32, pitch: 30, gamma: 0 }],
    location: { lat: 27.85, lng: 121.16 },
  });
  const second = computeObservationCalibration({
    reference: { slug: "vega", name: "织女星", azimuth: 160, altitude: 48, kind: "bright_star" },
    samples: [{ azimuth: 130, pitch: 25, gamma: 0 }],
    location: { lat: 27.85, lng: 121.16 },
  });

  assert.equal(refineObservationCalibration(first, second), null);
});

test("second calibration references avoid the first point and stay far from the horizon", () => {
  const references = [
    { slug: "moon", name: "月球", azimuth: 0, altitude: 40, kind: "moon" as const },
    { slug: "venus", name: "金星", azimuth: 50, altitude: 8, kind: "planet" as const },
    { slug: "vega", name: "织女星", azimuth: 100, altitude: 45, kind: "bright_star" as const },
    { slug: "sirius", name: "天狼星", azimuth: 200, altitude: 20, kind: "bright_star" as const },
  ];
  const candidates = buildSecondCalibrationReferences(references, references[0]);
  assert.deepEqual(candidates.map((reference) => reference.slug), ["vega", "sirius"]);
});
