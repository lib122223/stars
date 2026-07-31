export interface AstronomyImageSource {
  file: string;
  sourceUrl: string;
  credit: string;
  location: string;
  capturedAt: string;
  equipment: string;
  license: string;
}

export function commonsFile(file: string, width = 1100): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
}

export function commonsSource(file: string): string {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file).replace(/%20/g, "_")}`;
}

export function commonsImage(
  file: string,
  overrides: Partial<Omit<AstronomyImageSource, "file" | "sourceUrl">> & { sourceUrl?: string } = {},
): AstronomyImageSource {
  return {
    file,
    sourceUrl: overrides.sourceUrl ?? commonsSource(file),
    credit: overrides.credit ?? "Wikimedia Commons contributor",
    location: overrides.location ?? "真实天文影像",
    capturedAt: overrides.capturedAt ?? "见来源页面",
    equipment: overrides.equipment ?? "见来源页面",
    license: overrides.license ?? "见来源页面",
  };
}

const nasaIdsWithoutOriginal = new Set([
  "NHQ202012130001",
  "NHQ202012210001",
]);

export function nasaFile(nasaId: string, _size: "large" | "medium" | "small" = "large"): string {
  const size = nasaIdsWithoutOriginal.has(nasaId) ? "large" : "orig";
  return `https://images-assets.nasa.gov/image/${encodeURIComponent(nasaId)}/${encodeURIComponent(nasaId)}~${size}.jpg`;
}

export function nasaImage(
  nasaId: string,
  overrides: Partial<Omit<AstronomyImageSource, "file" | "sourceUrl">> & { sourceUrl?: string } = {},
): AstronomyImageSource {
  return {
    file: nasaId,
    sourceUrl: overrides.sourceUrl ?? `https://images.nasa.gov/details-${encodeURIComponent(nasaId)}`,
    credit: overrides.credit ?? "NASA Image and Video Library",
    location: overrides.location ?? "NASA space science observation",
    capturedAt: overrides.capturedAt ?? "See source page",
    equipment: overrides.equipment ?? "NASA spacecraft or observatory",
    license: overrides.license ?? "NASA public domain / see source page",
  };
}
