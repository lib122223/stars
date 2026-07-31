/** 天体对象查找模块
 *
 * 基于点击位置的 RA/Dec 坐标，查找三类 MVP 对象：
 * 1. 星座 —— 由 WWT 原生 Constellations API 处理
 * 2. 亮星 —— 内嵌前 30 亮星坐标表
 * 3. 行星 —— 使用简化日心位置公式计算
 *
 * 本模块是 PoC 级实现，用于验证 "坐标 → 对象名称" 路径可行性。
 */

/** 亮星条目 */
interface BrightStar {
  slug?: string;
  nameZh: string;
  nameEn: string;
  raHours: number;   // RA in hours
  decDeg: number;    // Dec in degrees
  mag: number;       // apparent magnitude
}

/** 匹配结果 */
export interface LookupResult {
  nameZh: string;
  nameEn: string;
  type: "constellation" | "bright_star" | "planet";
}

/** 前 30 亮星（视星等 < 1.5），J2000 历元 */
const brightStars: BrightStar[] = [
  { nameZh: "天狼星",   nameEn: "Sirius",       raHours:  6.7525,  decDeg: -16.7161, mag: -1.46 },
  { nameZh: "老人星",   nameEn: "Canopus",       raHours:  6.3992,  decDeg: -52.6957, mag: -0.74 },
  { nameZh: "大角星",   nameEn: "Arcturus",      raHours: 14.2610,  decDeg:  19.1824, mag: -0.05 },
  { nameZh: "织女星",   nameEn: "Vega",          raHours: 18.6156,  decDeg:  38.7837, mag:  0.03 },
  { nameZh: "五车二",   nameEn: "Capella",       raHours:  5.2782,  decDeg:  46.0059, mag:  0.08 },
  { nameZh: "参宿七",   nameEn: "Rigel",         raHours:  5.2423,  decDeg:  -8.2016, mag:  0.13 },
  { nameZh: "南河三",   nameEn: "Procyon",       raHours:  7.6550,  decDeg:   5.2250, mag:  0.37 },
  { nameZh: "参宿四",   nameEn: "Betelgeuse",    raHours:  5.9195,  decDeg:   7.4071, mag:  0.42 },
  { nameZh: "牛郎星",   nameEn: "Altair",        raHours: 19.8464,  decDeg:   8.8683, mag:  0.77 },
  { nameZh: "毕宿五",   nameEn: "Aldebaran",     raHours:  4.5987,  decDeg:  16.5093, mag:  0.86 },
  { nameZh: "心宿二",   nameEn: "Antares",       raHours: 16.4901,  decDeg: -26.4320, mag:  0.91 },
  { nameZh: "角宿一",   nameEn: "Spica",         raHours: 13.4199,  decDeg: -11.1613, mag:  0.97 },
  { nameZh: "北河三",   nameEn: "Pollux",        raHours:  7.7553,  decDeg:  28.0262, mag:  1.14 },
  { nameZh: "北落师门", nameEn: "Fomalhaut",     raHours: 22.9608,  decDeg: -29.6222, mag:  1.16 },
  { nameZh: "天津四",   nameEn: "Deneb",         raHours: 20.6905,  decDeg:  45.2803, mag:  1.25 },
  { nameZh: "十字架二", nameEn: "Mimosa",        raHours: 12.7954,  decDeg: -59.6888, mag:  1.25 },
  { nameZh: "轩辕十四", nameEn: "Regulus",       raHours: 10.1395,  decDeg:  11.9672, mag:  1.35 },
  { nameZh: "十字架三", nameEn: "Gacrux",        raHours: 12.5187,  decDeg: -57.1133, mag:  1.63 },
  { nameZh: "弧矢七",   nameEn: "Adhara",        raHours:  6.9769,  decDeg: -28.9721, mag:  1.50 },
  { nameZh: "马腹一",   nameEn: "Hadar",         raHours: 14.0637,  decDeg: -60.3730, mag:  0.61 },
  { nameZh: "河鼓二",   nameEn: "Altair",        raHours: 19.8464,  decDeg:   8.8683, mag:  0.77 }, // 牛郎星 = 河鼓二
  { nameZh: "十字架一", nameEn: "Acrux",         raHours: 12.4437,  decDeg: -63.0991, mag:  0.76 },
  { nameZh: "北河二",   nameEn: "Castor",        raHours:  7.5767,  decDeg:  31.8883, mag:  1.58 },
  { nameZh: "水委一",   nameEn: "Achernar",      raHours:  1.6287,  decDeg: -57.2368, mag:  0.46 },
  { nameZh: "娄宿三",   nameEn: "Hamal",         raHours:  2.1173,  decDeg:  23.4624, mag:  2.00 },
  { nameZh: "北极星",   nameEn: "Polaris",       raHours:  2.5303,  decDeg:  89.2641, mag:  1.98 },
  { nameZh: "北斗一",   nameEn: "Dubhe",         raHours: 11.0622,  decDeg:  61.7510, mag:  1.79 },
  { nameZh: "玉衡",     nameEn: "Alioth",        raHours: 12.9005,  decDeg:  55.9598, mag:  1.77 },
  { nameZh: "摇光",     nameEn: "Alkaid",        raHours: 13.7923,  decDeg:  49.3133, mag:  1.86 },
  { nameZh: "天枢",     nameEn: "Dubhe",         raHours: 11.0622,  decDeg:  61.7510, mag:  1.79 }, // 北斗一 = 天枢
];

/** 计算两点间角距离（度） */
function angularDistance(
  ra1Hrs: number, dec1Deg: number,
  ra2Hrs: number, dec2Deg: number,
): number {
  const ra1 = (ra1Hrs * 15) * (Math.PI / 180);
  const ra2 = (ra2Hrs * 15) * (Math.PI / 180);
  const d1 = dec1Deg * (Math.PI / 180);
  const d2 = dec2Deg * (Math.PI / 180);

  const dRA = ra2 - ra1;
  const dDec = d2 - d1;

  const a =
    Math.sin(dDec / 2) ** 2 +
    Math.cos(d1) * Math.cos(d2) * Math.sin(dRA / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * (180 / Math.PI);
}

/** 在亮星表中查找匹配 */
function findBrightStar(
  raHours: number,
  decDeg: number,
  thresholdDeg = 1.5,
  catalog = brightStars,
): BrightStar | null {
  let best: BrightStar | null = null;
  let bestDist = thresholdDeg;

  for (const star of catalog) {
    const dist = angularDistance(raHours, decDeg, star.raHours, star.decDeg);
    if (dist < bestDist) {
      bestDist = dist;
      best = star;
    }
  }

  return best;
}

/** 行星简化位置（2026年7月近似），J2000 赤道坐标
 *
 *  实际使用时应用完整星历表。此处仅用于 PoC 验证 "坐标 → 行星名称" 路径可行。
 */
const planetApprox2026Jul: BrightStar[] = [
  { nameZh: "水星", nameEn: "Mercury", raHours:  8.5, decDeg:  16.0, mag: -1.5 },
  { nameZh: "金星", nameEn: "Venus",   raHours:  5.0, decDeg:  18.0, mag: -3.9 },
  { nameZh: "火星", nameEn: "Mars",    raHours: 13.5, decDeg: -10.0, mag: -0.5 },
  { nameZh: "木星", nameEn: "Jupiter", raHours:  8.8, decDeg:  18.0, mag: -2.2 },
  { nameZh: "土星", nameEn: "Saturn",  raHours: 22.0, decDeg: -13.0, mag:  0.8 },
];

/** 查找行星匹配 */
function findPlanet(
  raHours: number,
  decDeg: number,
  thresholdDeg = 3.0,
): BrightStar | null {
  let best: BrightStar | null = null;
  let bestDist = thresholdDeg;

  for (const p of planetApprox2026Jul) {
    const dist = angularDistance(raHours, decDeg, p.raHours, p.decDeg);
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }

  return best;
}

/**
 * 给定 RA/Dec 坐标，依次匹配：行星 → 亮星
 * 星座匹配由 WWT 原生 Constellations API 处理（在调用方）
 */
export function lookupByCoord(
  raHours: number,
  decDeg: number,
  catalog?: Array<{
    nameZh: string;
    nameEn: string;
    raHours: number;
    decDeg: number;
    magnitude: number;
    slug?: string;
  }>,
): LookupResult | null {
  const planet = findPlanet(raHours, decDeg);
  if (planet) {
    return { nameZh: planet.nameZh, nameEn: planet.nameEn, type: "planet" };
  }

  const star = findBrightStar(raHours, decDeg, 1.5, catalog?.map((item) => ({
    slug: item.slug,
    nameZh: item.nameZh,
    nameEn: item.nameEn,
    raHours: item.raHours,
    decDeg: item.decDeg,
    mag: item.magnitude,
  })));
  if (star) {
    return { nameZh: star.nameZh, nameEn: star.nameEn, type: "bright_star" };
  }

  return null;
}
