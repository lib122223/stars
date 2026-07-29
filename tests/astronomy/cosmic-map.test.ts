import assert from "node:assert/strict";
import test from "node:test";
import {
  cosmicCatalog,
  projectEquatorialToPanorama,
  signedAngularDelta,
} from "../../lib/astronomy/cosmic-map";

test("right ascension wraps continuously across 0h and 24h", () => {
  assert.equal(signedAngularDelta(1, 359), 2);
  assert.equal(signedAngularDelta(359, 1), -2);

  const beforeWrap = projectEquatorialToPanorama({
    raHours: 23.9,
    decDeg: 0,
    centerRaDeg: 0,
    horizontalFovDeg: 150,
    width: 390,
    height: 720,
  });
  const afterWrap = projectEquatorialToPanorama({
    raHours: 0.1,
    decDeg: 0,
    centerRaDeg: 0,
    horizontalFovDeg: 150,
    width: 390,
    height: 720,
  });

  assert.ok(beforeWrap.x < 195);
  assert.ok(afterWrap.x > 195);
  assert.ok(Math.abs(afterWrap.x - beforeWrap.x) < 10);
});

test("right ascension controls only horizontal position", () => {
  const left = projectEquatorialToPanorama({
    raHours: 7,
    decDeg: 25,
    centerRaDeg: 120,
    horizontalFovDeg: 150,
    width: 400,
    height: 700,
  });
  const right = projectEquatorialToPanorama({
    raHours: 9,
    decDeg: 25,
    centerRaDeg: 120,
    horizontalFovDeg: 150,
    width: 400,
    height: 700,
  });

  assert.ok(right.x > left.x);
  assert.equal(right.y, left.y);
});

test("declination controls only vertical position", () => {
  const north = projectEquatorialToPanorama({
    raHours: 12,
    decDeg: 60,
    centerRaDeg: 180,
    horizontalFovDeg: 150,
    width: 400,
    height: 700,
  });
  const south = projectEquatorialToPanorama({
    raHours: 12,
    decDeg: -60,
    centerRaDeg: 180,
    horizontalFovDeg: 150,
    width: 400,
    height: 700,
  });

  assert.equal(north.x, south.x);
  assert.ok(north.y < south.y);
});

test("horizontal panning does not alter declination projection", () => {
  const first = projectEquatorialToPanorama({
    raHours: 5,
    decDeg: -18,
    centerRaDeg: 90,
    horizontalFovDeg: 150,
    width: 390,
    height: 720,
  });
  const panned = projectEquatorialToPanorama({
    raHours: 5,
    decDeg: -18,
    centerRaDeg: 210,
    horizontalFovDeg: 150,
    width: 390,
    height: 720,
  });

  assert.equal(first.y, panned.y);
});

test("objects outside the horizontal field project outside the viewport", () => {
  const projected = projectEquatorialToPanorama({
    raHours: 8,
    decDeg: 0,
    centerRaDeg: 0,
    horizontalFovDeg: 120,
    width: 400,
    height: 700,
  });

  assert.ok(projected.x > 400);
});

test("deep-sky catalog has valid unique coordinates and slugs", () => {
  assert.ok(cosmicCatalog.length >= 18);
  assert.equal(new Set(cosmicCatalog.map((object) => object.slug)).size, cosmicCatalog.length);

  for (const object of cosmicCatalog) {
    assert.ok(object.raHours >= 0 && object.raHours < 24, object.slug);
    assert.ok(object.decDeg >= -90 && object.decDeg <= 90, object.slug);
    assert.ok(object.nameZh.length > 0, object.slug);
    assert.ok(object.nameEn.length > 0, object.slug);
  }
});
