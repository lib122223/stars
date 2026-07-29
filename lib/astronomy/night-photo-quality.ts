export type NightPhotoQualityReason =
  | "usable"
  | "underexposed"
  | "light_interference"
  | "bright_background"
  | "cloud_or_haze"
  | "blurred"
  | "no_star_points";

export interface NightPhotoQuality {
  usable: boolean;
  reason: NightPhotoQualityReason;
  warning: Exclude<NightPhotoQualityReason, "usable" | "no_star_points"> | null;
  pointCount: number;
  averageLuminance: number;
  contrast: number;
  sharpness: number;
  saturatedRatio: number;
  brightPixelRatio: number;
}

function percentile(histogram: Uint32Array, pixelCount: number, fraction: number) {
  const target = Math.max(1, Math.ceil(pixelCount * fraction));
  let count = 0;
  for (let luminance = 0; luminance < histogram.length; luminance += 1) {
    count += histogram[luminance];
    if (count >= target) return luminance;
  }
  return 255;
}

function luminanceAt(pixels: Uint8ClampedArray, pixelIndex: number) {
  const offset = pixelIndex * 4;
  return (pixels[offset] + pixels[offset + 1] + pixels[offset + 2]) / 3;
}

export function analyzeNightPhotoQuality(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  pointCount: number,
): NightPhotoQuality {
  const safeWidth = Math.max(1, Math.floor(width));
  const safeHeight = Math.max(1, Math.floor(height));
  const pixelCount = Math.min(safeWidth * safeHeight, Math.floor(pixels.length / 4));
  if (pixelCount === 0) {
    return {
      usable: false,
      reason: "no_star_points",
      warning: null,
      pointCount,
      averageLuminance: 0,
      contrast: 0,
      sharpness: 0,
      saturatedRatio: 0,
      brightPixelRatio: 0,
    };
  }

  const histogram = new Uint32Array(256);
  let luminanceSum = 0;
  let squaredLuminanceSum = 0;
  let saturatedPixels = 0;
  let brightPixels = 0;
  let edgeSum = 0;
  let edgeCount = 0;

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const luminance = luminanceAt(pixels, pixelIndex);
    histogram[Math.max(0, Math.min(255, Math.round(luminance)))] += 1;
    luminanceSum += luminance;
    squaredLuminanceSum += luminance * luminance;
    if (luminance >= 245) saturatedPixels += 1;
    if (luminance >= 160) brightPixels += 1;

    const x = pixelIndex % safeWidth;
    const y = Math.floor(pixelIndex / safeWidth);
    if (x + 1 < safeWidth && pixelIndex + 1 < pixelCount) {
      edgeSum += Math.abs(luminance - luminanceAt(pixels, pixelIndex + 1));
      edgeCount += 1;
    }
    if (y + 1 < safeHeight && pixelIndex + safeWidth < pixelCount) {
      edgeSum += Math.abs(luminance - luminanceAt(pixels, pixelIndex + safeWidth));
      edgeCount += 1;
    }
  }

  const averageLuminance = luminanceSum / pixelCount;
  const variance = Math.max(0, squaredLuminanceSum / pixelCount - averageLuminance ** 2);
  const contrast = Math.sqrt(variance);
  const sharpness = edgeSum / Math.max(1, edgeCount);
  const saturatedRatio = saturatedPixels / pixelCount;
  const brightPixelRatio = brightPixels / pixelCount;
  const highLuminance = percentile(histogram, pixelCount, 0.99);

  let reason: NightPhotoQualityReason = "no_star_points";
  if (pointCount > 0) {
    reason = "usable";
  } else if (saturatedRatio >= 0.01 || averageLuminance >= 220) {
    reason = "light_interference";
  } else if (averageLuminance < 18 && highLuminance < 45) {
    reason = "underexposed";
  } else if (averageLuminance > 110 || brightPixelRatio > 0.25) {
    reason = "bright_background";
  } else if (averageLuminance >= 20 && contrast < 8) {
    reason = "cloud_or_haze";
  } else if (sharpness < 2.2 && contrast >= 8) {
    reason = "blurred";
  }

  let warning: NightPhotoQuality["warning"] = null;
  if (pointCount > 0) {
    if (saturatedRatio >= 0.01) warning = "light_interference";
    else if (averageLuminance > 95 || brightPixelRatio > 0.2) warning = "bright_background";
    else if (averageLuminance >= 25 && contrast < 10) warning = "cloud_or_haze";
  }

  return {
    usable: pointCount > 0,
    reason,
    warning,
    pointCount,
    averageLuminance,
    contrast,
    sharpness,
    saturatedRatio,
    brightPixelRatio,
  };
}
