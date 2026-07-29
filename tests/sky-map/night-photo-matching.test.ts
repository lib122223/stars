import assert from "node:assert/strict";
import test from "node:test";
import {
  cameraFieldOfView,
  matchBrightPointsToSky,
  projectHorizontalToImage,
} from "../../lib/astronomy/night-photo-matching";

const image = { width: 1200, height: 800 };
const view = { azimuth: 0, pitch: 35 };

test("camera zoom narrows the field of view used for matching", () => {
  const normal = cameraFieldOfView(image.width, image.height, 1);
  const zoomed = cameraFieldOfView(image.width, image.height, 2);

  assert.equal(normal.horizontal, 72);
  assert.ok(zoomed.horizontal < normal.horizontal);
  assert.ok(zoomed.vertical < normal.vertical);
});

test("zoomed bright-point coordinates still match the same sky object", () => {
  const star = { slug: "vega", name: "织女星", magnitude: 0.03, azimuth: 8, altitude: 35 };
  const normalFov = cameraFieldOfView(image.width, image.height, 1);
  const zoomedFov = cameraFieldOfView(image.width, image.height, 2);
  const normalPoint = projectHorizontalToImage(star, view, normalFov);
  const zoomedPoint = projectHorizontalToImage(star, view, zoomedFov);

  assert.ok(normalPoint);
  assert.ok(zoomedPoint);
  assert.ok(zoomedPoint.x > normalPoint.x);

  const matches = matchBrightPointsToSky(
    [{ ...zoomedPoint, brightness: 220 }],
    [star],
    view,
    image,
    2,
  );
  assert.equal(matches[0]?.slug, "vega");
});

test("a north-facing capture never offers a southern sky candidate", () => {
  const matches = matchBrightPointsToSky(
    [{ x: 0.5, y: 0.5, brightness: 220 }],
    [
      { slug: "north", name: "北方目标", magnitude: 1, azimuth: 2, altitude: 35 },
      { slug: "south", name: "南方目标", magnitude: 0, azimuth: 182, altitude: 35 },
    ],
    view,
    image,
    1,
  );

  assert.deepEqual(matches.map((candidate) => candidate.slug), ["north"]);
});

test("matching is deterministic for identical photo and pose data", () => {
  const points = [
    { x: 0.49, y: 0.5, brightness: 210 },
    { x: 0.65, y: 0.42, brightness: 170 },
  ];
  const stars = [
    { slug: "first", name: "目标一", magnitude: 1.2, azimuth: 1, altitude: 35 },
    { slug: "second", name: "目标二", magnitude: 2.1, azimuth: 10, altitude: 39 },
  ];

  const firstRun = matchBrightPointsToSky(points, stars, view, image, 1.5);
  const secondRun = matchBrightPointsToSky(points, stars, view, image, 1.5);
  assert.deepEqual(secondRun, firstRun);
});

test("calibrated matching penalizes altitude error more than the same horizontal error", () => {
  const matches = matchBrightPointsToSky(
    [{ x: 0.5, y: 0.5, brightness: 220 }],
    [
      { slug: "azimuth-offset", name: "方位偏差", magnitude: 1, azimuth: 4, altitude: 35 },
      { slug: "altitude-offset", name: "仰角偏差", magnitude: 1, azimuth: 0, altitude: 39 },
    ],
    view,
    image,
    1,
    { calibrated: true, estimatedAccuracy: 2.5 },
  );

  assert.equal(matches[0]?.slug, "azimuth-offset");
  assert.ok((matches[0]?.score ?? 0) > (matches[1]?.score ?? 0));
});

test("stable calibration rejects candidates with a large altitude mismatch", () => {
  const matches = matchBrightPointsToSky(
    [{ x: 0.5, y: 0.5, brightness: 220 }],
    [
      { slug: "aligned", name: "仰角一致", magnitude: 1, azimuth: 0, altitude: 35 },
      { slug: "too-high", name: "仰角过高", magnitude: 0, azimuth: 0, altitude: 43 },
    ],
    view,
    image,
    1,
    { calibrated: true, estimatedAccuracy: 2.5 },
  );

  assert.deepEqual(matches.map((candidate) => candidate.slug), ["aligned"]);
});

test("a single detected point cannot claim more than 65 percent calibrated confidence", () => {
  const matches = matchBrightPointsToSky(
    [{ x: 0.5, y: 0.5, brightness: 220 }],
    [{ slug: "aligned", name: "完全对齐", magnitude: 0, azimuth: 0, altitude: 35 }],
    view,
    image,
    1,
    { calibrated: true, estimatedAccuracy: 2.5 },
  );

  assert.equal(matches.length, 1);
  assert.ok(matches[0].score <= 0.65);
});

test("single-point confidence scaling preserves the stronger candidate ranking", () => {
  const matches = matchBrightPointsToSky(
    [{ x: 0.5, y: 0.5, brightness: 220 }],
    [
      { slug: "aligned", name: "完全对齐", magnitude: 1, azimuth: 0, altitude: 35 },
      { slug: "side", name: "横向偏移", magnitude: 1, azimuth: 5, altitude: 35 },
    ],
    view,
    image,
    1,
    { calibrated: true, estimatedAccuracy: 2.5 },
  );

  assert.equal(matches[0]?.slug, "aligned");
  assert.ok((matches[0]?.score ?? 0) > (matches[1]?.score ?? 0));
});

test("uncalibrated matching keeps the wider compatibility range", () => {
  const matches = matchBrightPointsToSky(
    [{ x: 0.5, y: 0.5, brightness: 220 }],
    [{ slug: "wide", name: "宽松候选", magnitude: 1, azimuth: 0, altitude: 43 }],
    view,
    image,
  );

  assert.equal(matches[0]?.slug, "wide");
  assert.equal(matches[0]?.calibrated, false);
});

test("lower-quality calibration widens the strict altitude tolerance", () => {
  const candidate = { slug: "offset", name: "偏移候选", magnitude: 1, azimuth: 0, altitude: 41 };
  const points = [{ x: 0.5, y: 0.5, brightness: 220 }];
  const precise = matchBrightPointsToSky(
    points,
    [candidate],
    view,
    image,
    1,
    { calibrated: true, estimatedAccuracy: 2.5 },
  );
  const lessPrecise = matchBrightPointsToSky(
    points,
    [candidate],
    view,
    image,
    1,
    { calibrated: true, estimatedAccuracy: 10 },
  );

  assert.equal(precise.length, 0);
  assert.equal(lessPrecise[0]?.slug, "offset");
});
