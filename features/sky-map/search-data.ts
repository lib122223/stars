/**
 * 搜索对象池 V2 — 核心对象 + 本地亮星数据层合并
 *
 * 接入 lib/astronomy/bright-stars.ts，扩展搜索结果池。
 * 核心对象与亮星层重复时（vega / sirius / betelgeuse / polaris），保留核心对象版本。
 */
import { activeBrightStars } from "@/lib/astronomy/bright-stars";

export interface SearchEntry {
  slug: string;
  nameZh: string;
  nameEn: string;
  objectType: string;
  searchAliases?: string[];
}

/** 核心对象池（可完整探索） */
const corePool: SearchEntry[] = [
  { slug: "jupiter",    nameZh: "木星",   nameEn: "Jupiter",    objectType: "planet" },
  { slug: "venus",      nameZh: "金星",   nameEn: "Venus",      objectType: "planet" },
  { slug: "mars",       nameZh: "火星",   nameEn: "Mars",       objectType: "planet" },
  { slug: "saturn",     nameZh: "土星",   nameEn: "Saturn",     objectType: "planet" },
  { slug: "moon",       nameZh: "月球",   nameEn: "Moon",       objectType: "planet" },
  { slug: "vega",       nameZh: "织女星", nameEn: "Vega",       objectType: "bright_star" },
  { slug: "sirius",     nameZh: "天狼星", nameEn: "Sirius",     objectType: "bright_star" },
  { slug: "betelgeuse", nameZh: "参宿四", nameEn: "Betelgeuse", objectType: "bright_star" },
  { slug: "polaris",    nameZh: "北极星", nameEn: "Polaris",    objectType: "bright_star" },
  { slug: "orion",      nameZh: "猎户座", nameEn: "Orion",      objectType: "constellation" },
];

/** 合并搜索池：核心对象 + 亮星层去重 */
function buildSearchPool(): SearchEntry[] {
  const coreSlugs = new Set(corePool.map((o) => o.slug));

  const starEntries: SearchEntry[] = activeBrightStars()
    .filter((s) => !coreSlugs.has(s.slug))
    .map((s) => ({
      slug: s.slug,
      nameZh: s.nameZh,
      nameEn: s.nameEn,
      objectType: "bright_star",
      searchAliases: s.searchAliases,
    }));

  return [...corePool, ...starEntries];
}

const searchPool = buildSearchPool();

/** 基础匹配：中文名 / slug / 英文名 / searchAliases */
export function searchObjects(query: string, max = 5): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return searchPool
    .filter((o) =>
      o.nameZh.includes(q) ||
      o.slug.toLowerCase().includes(q) ||
      o.nameEn.toLowerCase().includes(q) ||
      o.searchAliases?.some((a) => a.toLowerCase().includes(q)),
    )
    .slice(0, max);
}
