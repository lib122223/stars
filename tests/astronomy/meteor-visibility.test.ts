import assert from "node:assert/strict";
import test from "node:test";
import { assessMeteorVisibility } from "../../lib/astronomy/meteor-visibility";

const perseids = {
  slug: "perseids",
  nameZh: "英仙座流星雨",
  raHours: 3.2,
  decDeg: 58,
  peakDate: "2026-08-13",
  activeStart: "2026-07-17",
  activeEnd: "2026-08-24",
  zhr: 100,
};

test("meteor visibility returns a local direction and altitude", () => {
  const result = assessMeteorVisibility(perseids, { lat: 39.9, lng: 116.4 }, new Date("2026-08-10T12:00:00Z"));
  assert.notEqual(result.band, "not_visible");
  assert.ok(result.radiantAltitude != null && result.radiantAltitude > 0);
  assert.ok(result.direction.length > 0);
  assert.equal(result.activeNow, true);
});

test("meteor visibility can mark a low latitude shower as difficult", () => {
  const result = assessMeteorVisibility({
    ...perseids,
    raHours: 3.2,
    decDeg: 80,
  }, { lat: -60, lng: 0 }, new Date("2026-08-10T12:00:00Z"));
  assert.equal(result.band, "not_visible");
});
