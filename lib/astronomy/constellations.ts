import { activeBrightStars, type BrightStar } from "@/lib/astronomy/bright-stars";

export interface ConstellationLine {
  from: string;
  to: string;
}

export interface Constellation {
  slug: string;
  nameZh: string;
  nameEn: string;
  abbreviation: string;
  description: string;
  memberSlugs: string[];
  lines: ConstellationLine[];
  anchorSlug: string;
}

const constellations: Constellation[] = [
  {
    slug: "bootes",
    nameZh: "牧夫座",
    nameEn: "Boötes",
    abbreviation: "Boo",
    description: "北天春季星座。大角星是牧夫座的主星，周围可以沿着牧夫座的主要轮廓继续寻找牧夫座ε、牧夫座η以及其他较暗成员星。",
    memberSlugs: ["arcturus", "izar", "muphrid", "nekkar", "seginus", "princeps"],
    lines: [
      { from: "nekkar", to: "seginus" },
      { from: "seginus", to: "izar" },
      { from: "izar", to: "arcturus" },
      { from: "arcturus", to: "muphrid" },
      { from: "muphrid", to: "princeps" },
      { from: "princeps", to: "nekkar" },
    ],
    anchorSlug: "arcturus",
  },
  {
    slug: "orion",
    nameZh: "猎户座",
    nameEn: "Orion",
    abbreviation: "Ori",
    description: "冬季最容易辨认的星座之一，腰带三星是进入内部成员星视图的入口。",
    memberSlugs: ["betelgeuse", "bellatrix", "alnilam", "alnitak", "mintaka", "rigel", "saiph", "meissa"],
    lines: [
      { from: "alnitak", to: "alnilam" },
      { from: "alnilam", to: "mintaka" },
      { from: "alnitak", to: "betelgeuse" },
      { from: "mintaka", to: "bellatrix" },
      { from: "betelgeuse", to: "bellatrix" },
      { from: "betelgeuse", to: "saiph" },
      { from: "bellatrix", to: "rigel" },
      { from: "saiph", to: "rigel" },
      { from: "bellatrix", to: "meissa" },
    ],
    anchorSlug: "betelgeuse",
  },
  {
    slug: "ursa-major",
    nameZh: "大熊座",
    nameEn: "Ursa Major",
    abbreviation: "UMa",
    description: "北天星座，北斗七星是其中最醒目的成员星群。",
    memberSlugs: ["dubhe", "merak", "phecda", "megrez", "alioth", "mizar", "alkaid", "tania-borealis", "tania-australis", "alula-borealis"],
    lines: [
      { from: "dubhe", to: "merak" },
      { from: "merak", to: "phecda" },
      { from: "phecda", to: "megrez" },
      { from: "megrez", to: "dubhe" },
      { from: "megrez", to: "alioth" },
      { from: "alioth", to: "mizar" },
      { from: "mizar", to: "alkaid" },
      { from: "phecda", to: "tania-borealis" },
      { from: "alioth", to: "tania-australis" },
      { from: "alkaid", to: "alula-borealis" },
    ],
    anchorSlug: "dubhe",
  },
  {
    slug: "sagittarius",
    nameZh: "人马座",
    nameEn: "Sagittarius",
    abbreviation: "Sgr",
    description: "靠近银河系中心方向的夏季星座，主要恒星常被连接成茶壶轮廓。",
    memberSlugs: ["kaus-australis", "kaus-media", "kaus-borealis", "alnasl", "nunki", "ascella", "albaldah", "tau-sagittarii", "rukbat", "arkab-prior"],
    lines: [
      { from: "kaus-borealis", to: "kaus-media" },
      { from: "kaus-media", to: "kaus-australis" },
      { from: "kaus-australis", to: "ascella" },
      { from: "ascella", to: "nunki" },
      { from: "nunki", to: "kaus-borealis" },
      { from: "kaus-media", to: "alnasl" },
      { from: "alnasl", to: "rukbat" },
      { from: "rukbat", to: "arkab-prior" },
      { from: "kaus-borealis", to: "albaldah" },
      { from: "albaldah", to: "tau-sagittarii" },
    ],
    anchorSlug: "kaus-australis",
  },
  {
    slug: "gemini",
    nameZh: "双子座",
    nameEn: "Gemini",
    abbreviation: "Gem",
    description: "冬季黄道星座，以北河二和北河三为主要入口。",
    memberSlugs: ["castor", "pollux", "alhena", "wasat", "mekbuda", "tejat-prior", "mebsuta", "propus"],
    lines: [
      { from: "castor", to: "alhena" },
      { from: "pollux", to: "wasat" },
      { from: "wasat", to: "mekbuda" },
      { from: "alhena", to: "mekbuda" },
      { from: "castor", to: "pollux" },
      { from: "alhena", to: "tejat-prior" },
      { from: "tejat-prior", to: "propus" },
      { from: "pollux", to: "mebsuta" },
    ],
    anchorSlug: "pollux",
  },
  {
    slug: "cassiopeia",
    nameZh: "仙后座",
    nameEn: "Cassiopeia",
    abbreviation: "Cas",
    description: "北天著名的 W 形星座，适合在北方天空中用轮廓快速确认。",
    memberSlugs: ["schedar", "caph", "navi", "ruchbah", "segin", "achird"],
    lines: [
      { from: "caph", to: "schedar" },
      { from: "schedar", to: "navi" },
      { from: "navi", to: "ruchbah" },
      { from: "ruchbah", to: "segin" },
      { from: "navi", to: "achird" },
    ],
    anchorSlug: "schedar",
  },
  {
    slug: "cygnus",
    nameZh: "天鹅座",
    nameEn: "Cygnus",
    abbreviation: "Cyg",
    description: "夏季银河中的十字形星座，天津四是最容易确认的主星。",
    memberSlugs: ["deneb", "sadr", "albireo", "gienah-cygni", "delta-cygni"],
    lines: [
      { from: "deneb", to: "sadr" },
      { from: "sadr", to: "albireo" },
      { from: "sadr", to: "gienah-cygni" },
      { from: "sadr", to: "delta-cygni" },
    ],
    anchorSlug: "deneb",
  },
  {
    slug: "scorpius",
    nameZh: "天蝎座",
    nameEn: "Scorpius",
    abbreviation: "Sco",
    description: "夏季南方天空的长曲线星座，心宿二和尾部亮星构成明显的蝎形轮廓。",
    memberSlugs: ["antares", "dschubba", "acrab", "sargas", "shaula", "lesath", "jabbah", "fang", "girtab"],
    lines: [
      { from: "dschubba", to: "antares" },
      { from: "acrab", to: "dschubba" },
      { from: "dschubba", to: "jabbah" },
      { from: "antares", to: "sargas" },
      { from: "antares", to: "fang" },
      { from: "sargas", to: "shaula" },
      { from: "shaula", to: "lesath" },
      { from: "shaula", to: "girtab" },
    ],
    anchorSlug: "antares",
  },
  {
    slug: "andromeda",
    nameZh: "仙女座",
    nameEn: "Andromeda",
    abbreviation: "And",
    description: "秋季北天星座，壁宿二、奎宿九和天大将军一构成主要识别路径。",
    memberSlugs: ["alpheratz", "mirach", "almach", "delta-andromedae", "upsilon-andromedae", "iota-andromedae"],
    lines: [
      { from: "alpheratz", to: "mirach" },
      { from: "mirach", to: "almach" },
      { from: "mirach", to: "delta-andromedae" },
      { from: "almach", to: "upsilon-andromedae" },
      { from: "alpheratz", to: "iota-andromedae" },
    ],
    anchorSlug: "mirach",
  },
  {
    slug: "leo",
    nameZh: "狮子座",
    nameEn: "Leo",
    abbreviation: "Leo",
    description: "春季黄道星座，轩辕十四和狮子座头部的弧线是主要识别标志。",
    memberSlugs: ["regulus", "algieba", "denebola", "zeta-leonis", "zosma", "chertan", "eta-leonis"],
    lines: [
      { from: "regulus", to: "algieba" },
      { from: "algieba", to: "zeta-leonis" },
      { from: "zeta-leonis", to: "denebola" },
      { from: "algieba", to: "eta-leonis" },
      { from: "regulus", to: "chertan" },
      { from: "zosma", to: "denebola" },
    ],
    anchorSlug: "regulus",
  },
  {
    slug: "corona-borealis",
    nameZh: "北冕座",
    nameEn: "Corona Borealis",
    abbreviation: "CrB",
    description: "牧夫座附近的北天星座，贯索四是它的主星，其他成员排列成弧形冠冕。",
    memberSlugs: ["alphecca", "nusakan", "gamma-coronae-borealis", "delta-coronae-borealis", "epsilon-coronae-borealis", "theta-coronae-borealis"],
    lines: [
      { from: "alphecca", to: "nusakan" },
      { from: "nusakan", to: "gamma-coronae-borealis" },
      { from: "gamma-coronae-borealis", to: "delta-coronae-borealis" },
      { from: "alphecca", to: "epsilon-coronae-borealis" },
      { from: "epsilon-coronae-borealis", to: "theta-coronae-borealis" },
    ],
    anchorSlug: "alphecca",
  },
];

export function getConstellation(slug: string): Constellation | undefined {
  return constellations.find((constellation) => constellation.slug === slug);
}

export function getConstellationForStar(slug: string): Constellation | undefined {
  return constellations.find((constellation) => constellation.memberSlugs.includes(slug));
}

export function activeConstellations(): Constellation[] {
  return constellations;
}

export function getConstellationMembers(constellation: Constellation): BrightStar[] {
  const starsBySlug = new Map(activeBrightStars().map((star) => [star.slug, star]));
  return constellation.memberSlugs
    .map((slug) => starsBySlug.get(slug))
    .filter((star): star is BrightStar => Boolean(star));
}

export function findConstellationByName(query: string): Constellation | undefined {
  const normalized = query.trim().toLowerCase();
  return activeConstellations().find((constellation) =>
    constellation.slug === normalized
      || constellation.nameZh.toLowerCase() === normalized
      || constellation.nameEn.toLowerCase() === normalized
      || constellation.abbreviation.toLowerCase() === normalized,
  );
}

export function buildConstellationCard(constellation: Constellation) {
  const members = getConstellationMembers(constellation);
  return {
    whatIsIt: `${constellation.nameZh}（${constellation.nameEn}）是一个星座，不是一颗恒星。它由视线方向上彼此相邻的多颗恒星组成，成员星之间的距离并不代表它们在宇宙中的真实距离。`,
    whyWatchIt: `${constellation.description}进入星座视图后，系统会缩小视场并显示 ${members.length} 颗已录入的成员星，同时绘制用于认星的轮廓连线。`,
    whatNext: "打开 AR 对准后，准星附近的候选只会从当前星座成员中筛选，并显示最可能对应的恒星名称、方位和仰角，便于你逐颗确认。",
  };
}
