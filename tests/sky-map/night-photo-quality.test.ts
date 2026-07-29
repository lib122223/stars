import assert from "node:assert/strict";
import test from "node:test";
import { analyzeNightPhotoQuality } from "../../lib/astronomy/night-photo-quality";

function solidPixels(width: number, height: number, luminance: number) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = luminance;
    pixels[index + 1] = luminance;
    pixels[index + 2] = luminance;
    pixels[index + 3] = 255;
  }
  return pixels;
}

test("a dark frame without detected points reports insufficient exposure", () => {
  const quality = analyzeNightPhotoQuality(solidPixels(100, 100, 6), 100, 100, 0);

  assert.equal(quality.reason, "underexposed");
  assert.equal(quality.usable, false);
});

test("a saturated frame reports strong light interference", () => {
  const quality = analyzeNightPhotoQuality(solidPixels(100, 100, 252), 100, 100, 0);

  assert.equal(quality.reason, "light_interference");
  assert.equal(quality.usable, false);
});

test("a flat gray frame reports possible cloud or haze", () => {
  const quality = analyzeNightPhotoQuality(solidPixels(100, 100, 68), 100, 100, 0);

  assert.equal(quality.reason, "cloud_or_haze");
  assert.equal(quality.usable, false);
});

test("a low-sharpness gradient reports blur when exposure and contrast are present", () => {
  const width = 100;
  const height = 100;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = 25 + Math.round(x * 0.5);
      const index = (y * width + x) * 4;
      pixels[index] = value;
      pixels[index + 1] = value;
      pixels[index + 2] = value;
      pixels[index + 3] = 255;
    }
  }

  const quality = analyzeNightPhotoQuality(pixels, width, height, 0);
  assert.equal(quality.reason, "blurred");
});

test("a detected bright point remains usable and records limited evidence", () => {
  const quality = analyzeNightPhotoQuality(solidPixels(100, 100, 8), 100, 100, 1);

  assert.equal(quality.reason, "usable");
  assert.equal(quality.usable, true);
  assert.equal(quality.pointCount, 1);
});
