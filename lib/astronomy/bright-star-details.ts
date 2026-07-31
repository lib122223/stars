import { activeBrightStars, type BrightStar } from "@/lib/astronomy/bright-stars";
import { getStellarProfile } from "@/lib/astronomy/stellar-profile";

export interface BrightStarCard {
  whatIsIt: string;
  whyWatchIt: string;
  whatNext: string;
}

export interface RelatedBrightStar {
  slug: string;
  nameZh: string;
}

interface StarContext {
  constellationZh: string;
  constellationEn: string;
  group?: string;
  next?: string[];
}

const starContextBySlug: Record<string, StarContext> = {
  sirius: { constellationZh: "大犬座", constellationEn: "Canis Major", group: "winter", next: ["orion", "betelgeuse", "procyon"] },
  canopus: { constellationZh: "船底座", constellationEn: "Carina", group: "southern", next: ["sirius", "achernar", "agena"] },
  arcturus: { constellationZh: "牧夫座", constellationEn: "Bootes", group: "spring", next: ["spica", "regulus", "vega"] },
  vega: { constellationZh: "天琴座", constellationEn: "Lyra", group: "summer-triangle", next: ["altair", "deneb", "polaris"] },
  capella: { constellationZh: "御夫座", constellationEn: "Auriga", group: "winter", next: ["aldebaran", "pollux", "castor"] },
  rigel: { constellationZh: "猎户座", constellationEn: "Orion", group: "orion", next: ["betelgeuse", "sirius", "procyon"] },
  procyon: { constellationZh: "小犬座", constellationEn: "Canis Minor", group: "winter", next: ["sirius", "pollux", "castor"] },
  betelgeuse: { constellationZh: "猎户座", constellationEn: "Orion", group: "orion", next: ["rigel", "sirius", "orion"] },
  altair: { constellationZh: "天鹰座", constellationEn: "Aquila", group: "summer-triangle", next: ["vega", "deneb", "fomalhaut"] },
  aldebaran: { constellationZh: "金牛座", constellationEn: "Taurus", group: "winter", next: ["capella", "rigel", "betelgeuse"] },
  antares: { constellationZh: "天蝎座", constellationEn: "Scorpius", group: "milky-way", next: ["kaus-australis", "nunki", "spica"] },
  spica: { constellationZh: "室女座", constellationEn: "Virgo", group: "spring", next: ["arcturus", "regulus", "antares"] },
  polaris: { constellationZh: "小熊座", constellationEn: "Ursa Minor", group: "north", next: ["dubhe", "merak", "vega"] },
  regulus: { constellationZh: "狮子座", constellationEn: "Leo", group: "spring", next: ["arcturus", "spica", "pollux"] },
  deneb: { constellationZh: "天鹅座", constellationEn: "Cygnus", group: "summer-triangle", next: ["vega", "altair", "fomalhaut"] },
  achernar: { constellationZh: "波江座", constellationEn: "Eridanus", group: "southern", next: ["canopus", "fomalhaut", "sirius"] },
  agena: { constellationZh: "半人马座", constellationEn: "Centaurus", group: "southern", next: ["canopus", "spica", "antares"] },
  pollux: { constellationZh: "双子座", constellationEn: "Gemini", group: "gemini", next: ["castor", "procyon", "capella"] },
  fomalhaut: { constellationZh: "南鱼座", constellationEn: "Piscis Austrinus", group: "autumn", next: ["altair", "deneb", "achernar"] },
  castor: { constellationZh: "双子座", constellationEn: "Gemini", group: "gemini", next: ["pollux", "procyon", "capella"] },
  alioth: { constellationZh: "大熊座", constellationEn: "Ursa Major", group: "big-dipper", next: ["dubhe", "mizar", "alkaid"] },
  dubhe: { constellationZh: "大熊座", constellationEn: "Ursa Major", group: "big-dipper", next: ["merak", "alioth", "polaris"] },
  alkaid: { constellationZh: "大熊座", constellationEn: "Ursa Major", group: "big-dipper", next: ["mizar", "alioth", "dubhe"] },
  hamal: { constellationZh: "白羊座", constellationEn: "Aries", group: "autumn", next: ["alpheratz", "mirach", "aldebaran"] },
  mirach: { constellationZh: "仙女座", constellationEn: "Andromeda", group: "autumn", next: ["alpheratz", "hamal", "fomalhaut"] },
  alpheratz: { constellationZh: "仙女座", constellationEn: "Andromeda", group: "autumn", next: ["mirach", "hamal", "fomalhaut"] },
  mizar: { constellationZh: "大熊座", constellationEn: "Ursa Major", group: "big-dipper", next: ["alioth", "alkaid", "dubhe"] },
  merak: { constellationZh: "大熊座", constellationEn: "Ursa Major", group: "big-dipper", next: ["dubhe", "phecda", "polaris"] },
  phecda: { constellationZh: "大熊座", constellationEn: "Ursa Major", group: "big-dipper", next: ["merak", "megrez", "dubhe"] },
  megrez: { constellationZh: "大熊座", constellationEn: "Ursa Major", group: "big-dipper", next: ["phecda", "alioth", "mizar"] },
  "kaus-australis": { constellationZh: "人马座", constellationEn: "Sagittarius", group: "sagittarius", next: ["nunki", "kaus-media", "alnasl"] },
  nunki: { constellationZh: "人马座", constellationEn: "Sagittarius", group: "sagittarius", next: ["kaus-australis", "ascella", "kaus-borealis"] },
  ascella: { constellationZh: "人马座", constellationEn: "Sagittarius", group: "sagittarius", next: ["nunki", "kaus-media", "kaus-australis"] },
  "kaus-media": { constellationZh: "人马座", constellationEn: "Sagittarius", group: "sagittarius", next: ["kaus-australis", "kaus-borealis", "alnasl"] },
  "kaus-borealis": { constellationZh: "人马座", constellationEn: "Sagittarius", group: "sagittarius", next: ["kaus-media", "nunki", "albaldah"] },
  alnasl: { constellationZh: "人马座", constellationEn: "Sagittarius", group: "sagittarius", next: ["kaus-australis", "kaus-media", "ascella"] },
  albaldah: { constellationZh: "人马座", constellationEn: "Sagittarius", group: "sagittarius", next: ["kaus-borealis", "nunki", "tau-sagittarii"] },
  "tau-sagittarii": { constellationZh: "人马座", constellationEn: "Sagittarius", group: "sagittarius", next: ["nunki", "ascella", "rukbat"] },
  rukbat: { constellationZh: "人马座", constellationEn: "Sagittarius", group: "sagittarius", next: ["arkab-prior", "kaus-australis", "nunki"] },
  "arkab-prior": { constellationZh: "人马座", constellationEn: "Sagittarius", group: "sagittarius", next: ["rukbat", "kaus-australis", "nunki"] },
};

const groupDescription: Record<string, string> = {
  "summer-triangle": "它属于夏季大三角相关天区，和织女星、牛郎星、天津四可以一起形成夏季夜空的主骨架。",
  "big-dipper": "它属于北斗七星相关天区，和大熊座其他亮星连起来后，能形成最容易辨认的勺形结构。",
  sagittarius: "它属于人马座的“茶壶”星群附近，方向上接近银河中心，是夏季暗空下星点和银河最密集的区域之一。",
  gemini: "它属于双子座双星区域，北河二和北河三靠得很近，适合作为冬春夜空的一组成对目标来辨认。",
  orion: "它属于猎户座核心区域，周围亮星多、结构清楚，是最适合新手建立星座轮廓感的天区。",
  winter: "它属于冬季亮星密集区，附近常能同时看到猎户座、天狼星、南河三、北河二/三等高亮目标。",
  spring: "它属于春季夜空的亮星骨架，适合和大角星、角宿一、轩辕十四等目标一起定位。",
  autumn: "它属于秋季夜空的主要亮星区域，适合和仙女座、白羊座、南鱼座附近目标一起观察。",
  southern: "它偏向南方天区，在中国北方高度较低，越往南越容易看到。",
  "milky-way": "它靠近银河亮带相关天区，暗空条件下周围星点会明显增多。",
  north: "它靠近北天极方向，夜间位置变化很小，是判断北方和理解星空旋转的关键锚点。",
};

function formatRa(raHours: number): string {
  const h = Math.floor(raHours);
  const m = Math.round((raHours - h) * 60);
  return `${h}h${String(m).padStart(2, "0")}m`;
}

function formatDec(decDeg: number): string {
  const sign = decDeg >= 0 ? "+" : "-";
  const abs = Math.abs(decDeg);
  const d = Math.floor(abs);
  const m = Math.round((abs - d) * 60);
  return `${sign}${d}°${String(m).padStart(2, "0")}′`;
}

function magnitudeDescription(magnitude: number): string {
  if (magnitude < 0) return "属于极亮恒星，在城市环境里也通常很容易从背景星中分出来。";
  if (magnitude < 1) return "属于一等星级目标，亮度足够高，是观察模式里应该优先凸显的命名星。";
  if (magnitude < 2) return "亮度仍然适合肉眼辨认，晴朗夜晚在普通城市边缘也有机会看到。";
  if (magnitude < 3) return "亮度比一等星弱，需要较好的透明度和更暗的环境，但仍属于可用于认星的命名亮星。";
  return "亮度偏暗，更依赖暗空、透明度和手机视场中的辅助标记。";
}

export function getBrightStarContext(slug: string): StarContext {
  return starContextBySlug[slug] ?? { constellationZh: "对应星座", constellationEn: "Constellation" };
}

export function buildBrightStarCard(star: BrightStar): BrightStarCard {
  const context = getBrightStarContext(star.slug);
  const groupText = context.group ? groupDescription[context.group] : "";
  const profile = getStellarProfile(star);

  return {
    whatIsIt: `${star.nameZh}（${star.nameEn}）是${context.constellationZh}（${context.constellationEn}）的一颗恒星。它的亮度等级是${profile.brightnessLabel}（${profile.brightnessDefinition}），视星等约 ${star.magnitude.toFixed(2)}；在肉眼下通常呈${profile.visualColorLabel}。当前对象表采用 J2000 坐标：赤经 ${formatRa(star.raHours)}，赤纬 ${formatDec(star.decDeg)}。`,
    whyWatchIt: `${profile.nakedEyeVisibility}${magnitudeDescription(star.magnitude)}观察模式会根据你的时间、地点和手机朝向实时计算它的高度与方位，所以它在屏幕里的位置来自天球坐标换算，不是固定贴图。${profile.visualColorDescription}。${groupText ? ` ${groupText}` : ""}`,
    whatNext: buildNextText(star),
  };
}

export function getRelatedBrightStars(star: BrightStar): RelatedBrightStar[] {
  const bySlug = new Map(activeBrightStars().map((s) => [s.slug, s]));
  const related = getBrightStarContext(star.slug).next ?? [];
  return related
    .map((slug) => bySlug.get(slug))
    .filter((s): s is BrightStar => Boolean(s))
    .slice(0, 3)
    .map((s) => ({ slug: s.slug, nameZh: s.nameZh }));
}

function buildNextText(star: BrightStar): string {
  const related = getRelatedBrightStars(star);
  if (related.length === 0) {
    return `找到${star.nameZh}后，可以继续转动手机观察附近是否还有亮度接近的命名星，并比较它们的颜色、亮度和高度差。`;
  }
  return `找到${star.nameZh}后，可以继续看 ${related.map((s) => s.nameZh).join("、")}。这些目标和它在真实天空中属于相邻或同一识别路径，适合连着看。`;
}
