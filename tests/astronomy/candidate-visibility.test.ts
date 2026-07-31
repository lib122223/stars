import assert from "node:assert/strict";
import test from "node:test";
import {
  angularSeparationDegrees,
  areCandidatesTooClose,
  assessCandidateVisibility,
} from "../../lib/astronomy/candidate-visibility";

test("candidate visibility removes objects below the horizon", () => {
  assert.equal(assessCandidateVisibility(-1.1), "impossible");
  assert.equal(assessCandidateVisibility(-0.5), "low");
  assert.equal(assessCandidateVisibility(8), "visible");
});

test("angular separation handles the azimuth wraparound", () => {
  const separation = angularSeparationDegrees(
    { azimuth: 359.9, altitude: 35 },
    { azimuth: 0.1, altitude: 35 },
  );

  assert.ok(separation < 0.2);
  assert.equal(areCandidatesTooClose(
    { azimuth: 359.9, altitude: 35 },
    { azimuth: 0.1, altitude: 35 },
  ), true);
});

test("candidates separated by more than the ambiguity threshold stay distinct", () => {
  assert.equal(areCandidatesTooClose(
    { azimuth: 0, altitude: 35 },
    { azimuth: 4, altitude: 35 },
  ), false);
});
