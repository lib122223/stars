import assert from "node:assert/strict";
import test from "node:test";
import { findBrightStar } from "../../lib/astronomy/bright-stars";
import { getPlanetProfile } from "../../lib/astronomy/planet-profile";
import { getStellarProfile } from "../../lib/astronomy/stellar-profile";

test("classifies Vega as a first-magnitude star and keeps its blue-white color", () => {
  const vega = findBrightStar("vega");
  assert.ok(vega);

  const profile = getStellarProfile(vega);
  assert.equal(profile.brightnessLabel, "一等亮星");
  assert.equal(profile.magnitude, 0.03);
  assert.equal(profile.visualColorLabel, "蓝白色");
  assert.match(profile.brightnessGuide, /不是第一颗星/);
});

test("classifies Sirius separately from first-magnitude stars", () => {
  const sirius = findBrightStar("sirius");
  assert.ok(sirius);

  const profile = getStellarProfile(sirius);
  assert.equal(profile.brightnessLabel, "极亮恒星（负星等）");
  assert.match(profile.nakedEyeVisibility, /很容易/);
});

test("uses a cautious fallback color for stars without a curated color entry", () => {
  const profile = getStellarProfile({ slug: "uncurated-star", magnitude: 3.8 });
  assert.equal(profile.brightnessLabel, "较暗恒星");
  assert.equal(profile.visualColorLabel, "白色");
  assert.match(profile.visualColorDescription, /不容易/);
});

test("builds a planetary profile for Venus", () => {
  const profile = getPlanetProfile("venus");
  assert.ok(profile);

  assert.equal(profile.categoryLabel, "行星");
  assert.equal(profile.magnitudeLabel, "典型视星等");
  assert.equal(profile.magnitude, -4.7);
  assert.equal(profile.brightnessLabel, "极亮天体");
  assert.equal(profile.visualColorLabel, "淡黄色");
});
