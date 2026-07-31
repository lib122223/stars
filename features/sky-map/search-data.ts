import { activeBrightStars } from "@/lib/astronomy/bright-stars";
import { activeConstellations } from "@/lib/astronomy/constellations";
import { cosmicCatalog } from "@/lib/astronomy/cosmic-map";
import type { AstronomyCatalog } from "@/lib/astronomy/catalog-types";

/**
 * 搜索对象池 V3 — 数据库核心对象 + 本地活动亮星。
 *
 * 观察模式里能看到的命名亮星必须能搜索、能定位、能进入详情。
 */

export interface SearchEntry {
  slug: string;
  nameZh: string;
  nameEn: string;
  objectType: string;
  searchAliases?: string[];
}

const coreSearchPool: SearchEntry[] = [
  { slug: "sun",        nameZh: "太阳",   nameEn: "Sun",        objectType: "star" },
  { slug: "mercury",    nameZh: "水星",   nameEn: "Mercury",    objectType: "planet" },
  { slug: "jupiter",    nameZh: "木星",   nameEn: "Jupiter",    objectType: "planet" },
  { slug: "venus",      nameZh: "金星",   nameEn: "Venus",      objectType: "planet" },
  { slug: "mars",       nameZh: "火星",   nameEn: "Mars",       objectType: "planet" },
  { slug: "saturn",     nameZh: "土星",   nameEn: "Saturn",     objectType: "planet" },
  { slug: "uranus",     nameZh: "天王星", nameEn: "Uranus",     objectType: "planet" },
  { slug: "neptune",    nameZh: "海王星", nameEn: "Neptune",    objectType: "planet" },
  { slug: "moon",       nameZh: "月球",   nameEn: "Moon",       objectType: "planet" },
  { slug: "orion",      nameZh: "猎户座", nameEn: "Orion",      objectType: "constellation" },
];

const brightStarSearchPool: SearchEntry[] = activeBrightStars().map((s) => ({
  slug: s.slug,
  nameZh: s.nameZh,
  nameEn: s.nameEn,
  objectType: "bright_star",
  searchAliases: s.searchAliases,
}));

const constellationSearchPool: SearchEntry[] = activeConstellations().map((constellation) => ({
  slug: constellation.slug,
  nameZh: constellation.nameZh,
  nameEn: constellation.nameEn,
  objectType: "constellation",
  searchAliases: [constellation.abbreviation],
}));

const cosmicSearchPool: SearchEntry[] = cosmicCatalog.map((object) => ({
  slug: object.slug,
  nameZh: object.nameZh,
  nameEn: object.nameEn,
  objectType: object.type,
  searchAliases: object.aliases,
}));

const localSearchPool: SearchEntry[] = [
  ...coreSearchPool,
  ...constellationSearchPool.filter((s) => !coreSearchPool.some((o) => o.slug === s.slug)),
  ...brightStarSearchPool.filter((s) => !coreSearchPool.some((o) => o.slug === s.slug)),
  ...cosmicSearchPool,
];

/** 基础匹配：中文名 / slug / 英文名 / searchAliases */
function buildSearchPool(catalog?: AstronomyCatalog): SearchEntry[] {
  if (!catalog) return localSearchPool;
  const brightStarSearchPool: SearchEntry[] = catalog.brightStars.map((star) => ({
    slug: star.slug,
    nameZh: star.nameZh,
    nameEn: star.nameEn,
    objectType: "bright_star",
    searchAliases: star.searchAliases,
  }));
  const constellationSearchPool: SearchEntry[] = catalog.constellations.map((constellation) => ({
    slug: constellation.slug,
    nameZh: constellation.nameZh,
    nameEn: constellation.nameEn,
    objectType: "constellation",
    searchAliases: [constellation.abbreviation],
  }));
  const cosmicSearchPool: SearchEntry[] = catalog.cosmicObjects.map((object) => ({
    slug: object.slug,
    nameZh: object.nameZh,
    nameEn: object.nameEn,
    objectType: object.type,
    searchAliases: object.aliases,
  }));
  return [
    ...coreSearchPool,
    ...constellationSearchPool.filter((item) => !coreSearchPool.some((core) => core.slug === item.slug)),
    ...brightStarSearchPool.filter((item) => !coreSearchPool.some((core) => core.slug === item.slug)),
    ...cosmicSearchPool,
  ];
}

export function searchObjects(query: string, max = 5, catalog?: AstronomyCatalog): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return buildSearchPool(catalog)
    .filter((o) =>
      o.nameZh.includes(q) ||
      o.slug.toLowerCase().includes(q) ||
      o.nameEn.toLowerCase().includes(q) ||
      o.searchAliases?.some((a) => a.toLowerCase().includes(q)),
    )
    .slice(0, max);
}
