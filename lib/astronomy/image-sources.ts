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
