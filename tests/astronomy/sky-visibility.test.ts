import assert from "node:assert/strict";
import test from "node:test";
import {
  computeSkyVisibility,
  estimateLimitingMagnitude,
  nightLightTileAt,
} from "../../lib/astronomy/sky-visibility";

const summerNight = new Date("2026-07-28T13:00:00.000Z");
const wenzhou = { lat: 27.99, lng: 120.7 };

test("darker ground light produces a higher naked-eye limiting magnitude", () => {
  const brightCity = estimateLimitingMagnitude({
    conditionScore: 82,
    darknessScore: 8,
    moonIllumination: 0,
    moonAltitude: -20,
  });
  const darkSite = estimateLimitingMagnitude({
    conditionScore: 82,
    darknessScore: 92,
    moonIllumination: 0,
    moonAltitude: -20,
  });

  assert.ok(darkSite > brightCity + 2);
});

test("poor weather and a bright moon reduce the limiting magnitude", () => {
  const clearMoonless = estimateLimitingMagnitude({
    conditionScore: 90,
    darknessScore: 80,
    moonIllumination: 0.05,
    moonAltitude: -5,
  });
  const humidFullMoon = estimateLimitingMagnitude({
    conditionScore: 42,
    darknessScore: 80,
    moonIllumination: 1,
    moonAltitude: 55,
  });

  assert.ok(clearMoonless > humidFullMoon + 1.5);
});

test("a darker site exposes every bright-site target and additional faint stars", () => {
  const shared = {
    location: wenzhou,
    observationTime: summerNight,
    conditionScore: 84,
  };
  const bright = computeSkyVisibility({ ...shared, darknessScore: 5 });
  const dark = computeSkyVisibility({ ...shared, darknessScore: 95 });
  const darkSlugs = new Set(dark.objects.map((object) => object.slug));

  assert.ok(bright.objects.length > 0);
  assert.ok(dark.objects.length > bright.objects.length);
  assert.ok(bright.objects.every((object) => darkSlugs.has(object.slug)));
});

test("homepage recommendations are exactly the first four objects in the shared list", () => {
  const result = computeSkyVisibility({
    location: wenzhou,
    observationTime: summerNight,
    conditionScore: 78,
    darknessScore: 65,
  });

  assert.deepEqual(
    result.recommended.map((object) => object.slug),
    result.objects.slice(0, 4).map((object) => object.slug),
  );
});

test("NASA night-light tile coordinates use the same Web Mercator grid as the map", () => {
  const tile = nightLightTileAt(wenzhou.lat, wenzhou.lng, 8);

  assert.equal(tile.x, 213);
  assert.equal(tile.y, 107);
  assert.ok(tile.pixelX >= 0 && tile.pixelX < 256);
  assert.ok(tile.pixelY >= 0 && tile.pixelY < 256);
});
