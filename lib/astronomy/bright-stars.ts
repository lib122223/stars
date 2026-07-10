/**
 * 本地亮星对象数据层 V1
 *
 * 用途：为搜索扩容、StarCanvas 扩容和后续对象池扩展提供静态数据基础。
 * 第一版使用 TypeScript 常量数据，不依赖数据库表或外部 API。
 *
 * 字段说明：
 *   raHours  — 赤经 (Right Ascension)，单位：小时 (0–24)
 *   decDeg   — 赤纬 (Declination)，单位：度 (-90–+90)
 *   magnitude — 视星等 (apparent magnitude)，越小越亮
 *   isDetailReady — 当前是否已有完整的 object_cards 详情承接
 *   isActive  — 是否参与搜索 / 星图渲染
 *   searchAliases — 可选搜索别名（中文简称、常见英文变体等）
 */

export interface BrightStar {
  slug: string;
  nameZh: string;
  nameEn: string;
  raHours: number;
  decDeg: number;
  magnitude: number;
  isDetailReady: boolean;
  isActive: boolean;
  searchAliases?: string[];
}

/** 本地亮星样本 — 15 颗高认知亮星，覆盖不同亮度和天区 */
export const brightStars: BrightStar[] = [
  {
    slug: "sirius",     nameZh: "天狼星", nameEn: "Sirius",
    raHours: 6.7525, decDeg: -16.7161, magnitude: -1.46,
    isDetailReady: true, isActive: true,
    searchAliases: ["大犬座α", "Dog Star"],
  },
  {
    slug: "canopus",    nameZh: "老人星", nameEn: "Canopus",
    raHours: 6.3992, decDeg: -52.6957, magnitude: -0.74,
    isDetailReady: false, isActive: true,
    searchAliases: ["船底座α"],
  },
  {
    slug: "arcturus",   nameZh: "大角星", nameEn: "Arcturus",
    raHours: 14.2610, decDeg: 19.1824, magnitude: -0.05,
    isDetailReady: false, isActive: true,
    searchAliases: ["牧夫座α"],
  },
  {
    slug: "vega",       nameZh: "织女星", nameEn: "Vega",
    raHours: 18.6156, decDeg: 38.7837, magnitude: 0.03,
    isDetailReady: true, isActive: true,
    searchAliases: ["天琴座α"],
  },
  {
    slug: "capella",    nameZh: "五车二", nameEn: "Capella",
    raHours: 5.2782, decDeg: 46.0059, magnitude: 0.08,
    isDetailReady: false, isActive: true,
    searchAliases: ["御夫座α"],
  },
  {
    slug: "rigel",      nameZh: "参宿七", nameEn: "Rigel",
    raHours: 5.2423, decDeg: -8.2016, magnitude: 0.13,
    isDetailReady: false, isActive: true,
    searchAliases: ["猎户座β"],
  },
  {
    slug: "procyon",    nameZh: "南河三", nameEn: "Procyon",
    raHours: 7.6550, decDeg: 5.2250, magnitude: 0.37,
    isDetailReady: false, isActive: true,
    searchAliases: ["小犬座α"],
  },
  {
    slug: "betelgeuse", nameZh: "参宿四", nameEn: "Betelgeuse",
    raHours: 5.9195, decDeg: 7.4071, magnitude: 0.42,
    isDetailReady: true, isActive: true,
    searchAliases: ["猎户座α", "Alpha Orionis"],
  },
  {
    slug: "altair",     nameZh: "牛郎星", nameEn: "Altair",
    raHours: 19.8464, decDeg: 8.8683, magnitude: 0.77,
    isDetailReady: false, isActive: true,
    searchAliases: ["河鼓二", "天鹰座α"],
  },
  {
    slug: "aldebaran",  nameZh: "毕宿五", nameEn: "Aldebaran",
    raHours: 4.5987, decDeg: 16.5093, magnitude: 0.86,
    isDetailReady: false, isActive: true,
    searchAliases: ["金牛座α"],
  },
  {
    slug: "antares",    nameZh: "心宿二", nameEn: "Antares",
    raHours: 16.4901, decDeg: -26.4320, magnitude: 0.91,
    isDetailReady: false, isActive: true,
    searchAliases: ["天蝎座α"],
  },
  {
    slug: "spica",      nameZh: "角宿一", nameEn: "Spica",
    raHours: 13.4199, decDeg: -11.1613, magnitude: 0.97,
    isDetailReady: false, isActive: true,
    searchAliases: ["室女座α"],
  },
  {
    slug: "polaris",    nameZh: "北极星", nameEn: "Polaris",
    raHours: 2.5303, decDeg: 89.2641, magnitude: 1.98,
    isDetailReady: true, isActive: true,
    searchAliases: ["小熊座α", "North Star"],
  },
  {
    slug: "regulus",    nameZh: "轩辕十四", nameEn: "Regulus",
    raHours: 10.1395, decDeg: 11.9672, magnitude: 1.35,
    isDetailReady: false, isActive: true,
    searchAliases: ["狮子座α"],
  },
  {
    slug: "deneb",      nameZh: "天津四", nameEn: "Deneb",
    raHours: 20.6905, decDeg: 45.2803, magnitude: 1.25,
    isDetailReady: false, isActive: true,
    searchAliases: ["天鹅座α"],
  },
];

/** 按 slug 查找亮星 */
export function findBrightStar(slug: string): BrightStar | undefined {
  return brightStars.find((s) => s.slug === slug);
}

/** 所有可参与搜索的亮星（isActive = true） */
export function activeBrightStars(): BrightStar[] {
  return brightStars.filter((s) => s.isActive);
}
