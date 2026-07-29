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
  // ---- V2 扩容：15 颗有名亮星（mag 0.46–3.31） ----
  {
    slug: "achernar",   nameZh: "水委一", nameEn: "Achernar",
    raHours: 1.629, decDeg: -57.237, magnitude: 0.46,
    isDetailReady: false, isActive: true,
    searchAliases: ["波江座α"],
  },
  {
    slug: "agena",      nameZh: "马腹一", nameEn: "Agena",
    raHours: 14.063, decDeg: -60.373, magnitude: 0.61,
    isDetailReady: false, isActive: true,
    searchAliases: ["半人马座β", "Hadar"],
  },
  {
    slug: "pollux",     nameZh: "北河三", nameEn: "Pollux",
    raHours: 7.755, decDeg: 28.026, magnitude: 1.14,
    isDetailReady: false, isActive: true,
    searchAliases: ["双子座β"],
  },
  {
    slug: "fomalhaut",  nameZh: "北落师门", nameEn: "Fomalhaut",
    raHours: 22.960, decDeg: -29.622, magnitude: 1.16,
    isDetailReady: false, isActive: true,
    searchAliases: ["南鱼座α"],
  },
  {
    slug: "castor",     nameZh: "北河二", nameEn: "Castor",
    raHours: 7.582, decDeg: 31.888, magnitude: 1.58,
    isDetailReady: false, isActive: true,
    searchAliases: ["双子座α"],
  },
  {
    slug: "alioth",     nameZh: "玉衡", nameEn: "Alioth",
    raHours: 12.900, decDeg: 55.960, magnitude: 1.77,
    isDetailReady: false, isActive: true,
    searchAliases: ["大熊座ε"],
  },
  {
    slug: "dubhe",      nameZh: "天枢", nameEn: "Dubhe",
    raHours: 11.062, decDeg: 61.751, magnitude: 1.79,
    isDetailReady: false, isActive: true,
    searchAliases: ["大熊座α"],
  },
  {
    slug: "alkaid",     nameZh: "摇光", nameEn: "Alkaid",
    raHours: 13.792, decDeg: 49.313, magnitude: 1.86,
    isDetailReady: false, isActive: true,
    searchAliases: ["大熊座η"],
  },
  {
    slug: "hamal",      nameZh: "娄宿三", nameEn: "Hamal",
    raHours: 2.118, decDeg: 23.462, magnitude: 2.01,
    isDetailReady: false, isActive: true,
    searchAliases: ["白羊座α"],
  },
  {
    slug: "mirach",     nameZh: "奎宿九", nameEn: "Mirach",
    raHours: 1.163, decDeg: 35.621, magnitude: 2.05,
    isDetailReady: false, isActive: true,
    searchAliases: ["仙女座β"],
  },
  {
    slug: "alpheratz",  nameZh: "壁宿二", nameEn: "Alpheratz",
    raHours: 0.139, decDeg: 29.090, magnitude: 2.07,
    isDetailReady: false, isActive: true,
    searchAliases: ["仙女座α"],
  },
  {
    slug: "mizar",      nameZh: "开阳", nameEn: "Mizar",
    raHours: 13.399, decDeg: 54.925, magnitude: 2.27,
    isDetailReady: false, isActive: true,
    searchAliases: ["大熊座ζ"],
  },
  {
    slug: "merak",      nameZh: "天璇", nameEn: "Merak",
    raHours: 11.031, decDeg: 56.382, magnitude: 2.37,
    isDetailReady: false, isActive: true,
    searchAliases: ["大熊座β"],
  },
  {
    slug: "phecda",     nameZh: "天玑", nameEn: "Phecda",
    raHours: 11.897, decDeg: 53.695, magnitude: 2.44,
    isDetailReady: false, isActive: true,
    searchAliases: ["大熊座γ"],
  },
  {
    slug: "megrez",     nameZh: "天权", nameEn: "Megrez",
    raHours: 12.257, decDeg: 57.033, magnitude: 3.31,
    isDetailReady: false, isActive: true,
    searchAliases: ["大熊座δ"],
  },
  {
    slug: "kaus-australis", nameZh: "箕宿三", nameEn: "Kaus Australis",
    raHours: 18.4029, decDeg: -34.3846, magnitude: 1.85,
    isDetailReady: false, isActive: true,
    searchAliases: ["人马座ε", "Epsilon Sagittarii"],
  },
  {
    slug: "nunki", nameZh: "斗宿四", nameEn: "Nunki",
    raHours: 18.9211, decDeg: -26.2967, magnitude: 2.05,
    isDetailReady: false, isActive: true,
    searchAliases: ["人马座σ", "Sigma Sagittarii"],
  },
  {
    slug: "ascella", nameZh: "斗宿一", nameEn: "Ascella",
    raHours: 19.0435, decDeg: -29.8801, magnitude: 2.60,
    isDetailReady: false, isActive: true,
    searchAliases: ["人马座ζ", "Zeta Sagittarii"],
  },
  {
    slug: "kaus-media", nameZh: "箕宿二", nameEn: "Kaus Media",
    raHours: 18.3499, decDeg: -29.8281, magnitude: 2.72,
    isDetailReady: false, isActive: true,
    searchAliases: ["人马座δ", "Delta Sagittarii"],
  },
  {
    slug: "kaus-borealis", nameZh: "斗宿二", nameEn: "Kaus Borealis",
    raHours: 18.4662, decDeg: -25.4217, magnitude: 2.82,
    isDetailReady: false, isActive: true,
    searchAliases: ["人马座λ", "Lambda Sagittarii"],
  },
  {
    slug: "alnasl", nameZh: "箕宿一", nameEn: "Alnasl",
    raHours: 18.0968, decDeg: -30.4241, magnitude: 2.98,
    isDetailReady: false, isActive: true,
    searchAliases: ["人马座γ", "Gamma Sagittarii"],
  },
  {
    slug: "albaldah", nameZh: "建增二", nameEn: "Albaldah",
    raHours: 19.1627, decDeg: -21.0236, magnitude: 2.89,
    isDetailReady: false, isActive: true,
    searchAliases: ["人马座π", "Pi Sagittarii"],
  },
  {
    slug: "tau-sagittarii", nameZh: "斗宿五", nameEn: "Tau Sagittarii",
    raHours: 19.1157, decDeg: -27.6704, magnitude: 3.32,
    isDetailReady: false, isActive: true,
    searchAliases: ["人马座τ"],
  },
  {
    slug: "rukbat", nameZh: "天渊三", nameEn: "Rukbat",
    raHours: 19.3981, decDeg: -40.6162, magnitude: 3.97,
    isDetailReady: false, isActive: true,
    searchAliases: ["人马座α", "Alpha Sagittarii"],
  },
  {
    slug: "arkab-prior", nameZh: "狗国一", nameEn: "Arkab Prior",
    raHours: 19.3773, decDeg: -44.4590, magnitude: 3.96,
    isDetailReady: false, isActive: true,
    searchAliases: ["人马座β1", "Beta1 Sagittarii"],
  },
  // ---- V3 扩容：补齐主要星座的可识别恒星 ----
  {
    slug: "alnitak", nameZh: "参宿一", nameEn: "Alnitak",
    raHours: 5.6793, decDeg: -1.9426, magnitude: 1.74,
    isDetailReady: false, isActive: true,
    searchAliases: ["猎户座ζ", "Zeta Orionis"],
  },
  {
    slug: "alnilam", nameZh: "参宿二", nameEn: "Alnilam",
    raHours: 5.6036, decDeg: -1.2019, magnitude: 1.69,
    isDetailReady: false, isActive: true,
    searchAliases: ["猎户座ε", "Epsilon Orionis"],
  },
  {
    slug: "mintaka", nameZh: "参宿三", nameEn: "Mintaka",
    raHours: 5.5334, decDeg: -0.2991, magnitude: 2.23,
    isDetailReady: false, isActive: true,
    searchAliases: ["猎户座δ", "Delta Orionis"],
  },
  {
    slug: "bellatrix", nameZh: "参宿五", nameEn: "Bellatrix",
    raHours: 5.4189, decDeg: 6.3497, magnitude: 1.64,
    isDetailReady: false, isActive: true,
    searchAliases: ["猎户座γ", "Gamma Orionis"],
  },
  {
    slug: "saiph", nameZh: "参宿六", nameEn: "Saiph",
    raHours: 5.7959, decDeg: -9.6696, magnitude: 2.07,
    isDetailReady: false, isActive: true,
    searchAliases: ["猎户座κ", "Kappa Orionis"],
  },
  {
    slug: "adhara", nameZh: "弧矢七", nameEn: "Adhara",
    raHours: 6.9771, decDeg: -28.9721, magnitude: 1.50,
    isDetailReady: false, isActive: true,
    searchAliases: ["大犬座ε", "Epsilon Canis Majoris"],
  },
  {
    slug: "wezen", nameZh: "弧矢二", nameEn: "Wezen",
    raHours: 7.1399, decDeg: -26.3932, magnitude: 1.83,
    isDetailReady: false, isActive: true,
    searchAliases: ["大犬座δ", "Delta Canis Majoris"],
  },
  {
    slug: "mirzam", nameZh: "弧矢一", nameEn: "Mirzam",
    raHours: 6.3783, decDeg: -17.9559, magnitude: 1.98,
    isDetailReady: false, isActive: true,
    searchAliases: ["大犬座β", "Beta Canis Majoris"],
  },
  {
    slug: "elnath", nameZh: "五车五", nameEn: "Elnath",
    raHours: 5.4382, decDeg: 28.6075, magnitude: 1.65,
    isDetailReady: false, isActive: true,
    searchAliases: ["金牛座β", "Beta Tauri"],
  },
  {
    slug: "menkalinan", nameZh: "五车三", nameEn: "Menkalinan",
    raHours: 5.9921, decDeg: 44.9474, magnitude: 1.90,
    isDetailReady: false, isActive: true,
    searchAliases: ["御夫座β", "Beta Aurigae"],
  },
  {
    slug: "alhena", nameZh: "井宿三", nameEn: "Alhena",
    raHours: 6.6285, decDeg: 16.3993, magnitude: 1.93,
    isDetailReady: false, isActive: true,
    searchAliases: ["双子座γ", "Gamma Geminorum"],
  },
  {
    slug: "mirfak", nameZh: "天船三", nameEn: "Mirfak",
    raHours: 3.4054, decDeg: 49.8612, magnitude: 1.79,
    isDetailReady: false, isActive: true,
    searchAliases: ["英仙座α", "Alpha Persei"],
  },
  {
    slug: "algol", nameZh: "大陵五", nameEn: "Algol",
    raHours: 3.1361, decDeg: 40.9556, magnitude: 2.12,
    isDetailReady: false, isActive: true,
    searchAliases: ["英仙座β", "Demon Star"],
  },
  {
    slug: "almach", nameZh: "天大将军一", nameEn: "Almach",
    raHours: 2.0649, decDeg: 42.3297, magnitude: 2.10,
    isDetailReady: false, isActive: true,
    searchAliases: ["仙女座γ", "Gamma Andromedae"],
  },
  {
    slug: "diphda", nameZh: "土司空", nameEn: "Diphda",
    raHours: 0.7265, decDeg: -17.9866, magnitude: 2.04,
    isDetailReady: false, isActive: true,
    searchAliases: ["鲸鱼座β", "Beta Ceti"],
  },
  {
    slug: "menkar", nameZh: "天囷一", nameEn: "Menkar",
    raHours: 3.0379, decDeg: 4.0897, magnitude: 2.54,
    isDetailReady: false, isActive: true,
    searchAliases: ["鲸鱼座α", "Alpha Ceti"],
  },
  {
    slug: "sheratan", nameZh: "娄宿一", nameEn: "Sheratan",
    raHours: 1.9107, decDeg: 20.8080, magnitude: 2.64,
    isDetailReady: false, isActive: true,
    searchAliases: ["白羊座β", "Beta Arietis"],
  },
  {
    slug: "markab", nameZh: "室宿一", nameEn: "Markab",
    raHours: 23.0793, decDeg: 15.2053, magnitude: 2.49,
    isDetailReady: false, isActive: true,
    searchAliases: ["飞马座α", "Alpha Pegasi"],
  },
  {
    slug: "scheat", nameZh: "室宿二", nameEn: "Scheat",
    raHours: 23.0629, decDeg: 28.0828, magnitude: 2.42,
    isDetailReady: false, isActive: true,
    searchAliases: ["飞马座β", "Beta Pegasi"],
  },
  {
    slug: "enif", nameZh: "危宿三", nameEn: "Enif",
    raHours: 21.7364, decDeg: 9.8750, magnitude: 2.39,
    isDetailReady: false, isActive: true,
    searchAliases: ["飞马座ε", "Epsilon Pegasi"],
  },
  {
    slug: "alnair", nameZh: "鹤一", nameEn: "Alnair",
    raHours: 22.1372, decDeg: -46.9609, magnitude: 1.74,
    isDetailReady: false, isActive: true,
    searchAliases: ["天鹤座α", "Alpha Gruis"],
  },
  {
    slug: "peacock", nameZh: "孔雀十一", nameEn: "Peacock",
    raHours: 20.4275, decDeg: -56.7351, magnitude: 1.94,
    isDetailReady: false, isActive: true,
    searchAliases: ["孔雀座α", "Alpha Pavonis"],
  },
  {
    slug: "miaplacidus", nameZh: "船底座β", nameEn: "Miaplacidus",
    raHours: 9.2200, decDeg: -69.7172, magnitude: 1.67,
    isDetailReady: false, isActive: true,
    searchAliases: ["船底座β", "Beta Carinae"],
  },
  {
    slug: "avior", nameZh: "船底座ε", nameEn: "Avior",
    raHours: 8.3752, decDeg: -59.5093, magnitude: 1.86,
    isDetailReady: false, isActive: true,
    searchAliases: ["船底座ε", "Epsilon Carinae"],
  },
  {
    slug: "aspidiske", nameZh: "船底座ι", nameEn: "Aspidiske",
    raHours: 9.2848, decDeg: -59.2750, magnitude: 2.25,
    isDetailReady: false, isActive: true,
    searchAliases: ["船底座ι", "Iota Carinae"],
  },
  {
    slug: "sargas", nameZh: "尾宿五", nameEn: "Sargas",
    raHours: 17.6219, decDeg: -42.9978, magnitude: 1.86,
    isDetailReady: false, isActive: true,
    searchAliases: ["天蝎座θ", "Theta Scorpii"],
  },
  {
    slug: "shaula", nameZh: "尾宿八", nameEn: "Shaula",
    raHours: 17.5601, decDeg: -37.1038, magnitude: 1.62,
    isDetailReady: false, isActive: true,
    searchAliases: ["天蝎座λ", "Lambda Scorpii"],
  },
  {
    slug: "dschubba", nameZh: "房宿三", nameEn: "Dschubba",
    raHours: 16.0056, decDeg: -22.6218, magnitude: 2.29,
    isDetailReady: false, isActive: true,
    searchAliases: ["天蝎座δ", "Delta Scorpii"],
  },
  {
    slug: "acrab", nameZh: "房宿四", nameEn: "Acrab",
    raHours: 16.0906, decDeg: -19.8054, magnitude: 2.62,
    isDetailReady: false, isActive: true,
    searchAliases: ["天蝎座β", "Beta Scorpii"],
  },
  {
    slug: "sabik", nameZh: "天市右垣五", nameEn: "Sabik",
    raHours: 17.1728, decDeg: -15.7249, magnitude: 2.43,
    isDetailReady: false, isActive: true,
    searchAliases: ["蛇夫座η", "Eta Ophiuchi"],
  },
  {
    slug: "rasalhague", nameZh: "侯", nameEn: "Rasalhague",
    raHours: 17.5822, decDeg: 12.5600, magnitude: 2.07,
    isDetailReady: false, isActive: true,
    searchAliases: ["蛇夫座α", "Alpha Ophiuchi"],
  },
  {
    slug: "cebalrai", nameZh: "蛇夫座β", nameEn: "Cebalrai",
    raHours: 17.7245, decDeg: 4.5673, magnitude: 2.76,
    isDetailReady: false, isActive: true,
    searchAliases: ["蛇夫座β", "Beta Ophiuchi"],
  },
  {
    slug: "alphecca", nameZh: "贯索四", nameEn: "Alphecca",
    raHours: 15.5781, decDeg: 26.7147, magnitude: 2.23,
    isDetailReady: false, isActive: true,
    searchAliases: ["北冕座α", "Alpha Coronae Borealis"],
  },
  {
    slug: "izar", nameZh: "牧夫座ε", nameEn: "Izar",
    raHours: 14.7498, decDeg: 27.0742, magnitude: 2.37,
    isDetailReady: false, isActive: true,
    searchAliases: ["牧夫座ε", "Epsilon Boötis"],
  },
  {
    slug: "muphrid", nameZh: "牧夫座η", nameEn: "Muphrid",
    raHours: 13.9114, decDeg: 18.3977, magnitude: 2.68,
    isDetailReady: false, isActive: true,
    searchAliases: ["牧夫座η", "Eta Boötis"],
  },
  {
    slug: "denebola", nameZh: "五帝座一", nameEn: "Denebola",
    raHours: 11.8177, decDeg: 14.5721, magnitude: 2.14,
    isDetailReady: false, isActive: true,
    searchAliases: ["狮子座β", "Beta Leonis"],
  },
  {
    slug: "algieba", nameZh: "轩辕二", nameEn: "Algieba",
    raHours: 10.3328, decDeg: 19.8415, magnitude: 2.08,
    isDetailReady: false, isActive: true,
    searchAliases: ["狮子座γ", "Gamma Leonis"],
  },
  {
    slug: "porrima", nameZh: "太微左垣二", nameEn: "Porrima",
    raHours: 12.6943, decDeg: -1.4494, magnitude: 2.74,
    isDetailReady: false, isActive: true,
    searchAliases: ["室女座γ", "Gamma Virginis"],
  },
  {
    slug: "vindemiatrix", nameZh: "太微左垣五", nameEn: "Vindemiatrix",
    raHours: 13.0364, decDeg: 10.9592, magnitude: 2.83,
    isDetailReady: false, isActive: true,
    searchAliases: ["室女座ε", "Epsilon Virginis"],
  },
  {
    slug: "cor-caroli", nameZh: "常陈一", nameEn: "Cor Caroli",
    raHours: 12.9338, decDeg: 38.3184, magnitude: 2.84,
    isDetailReady: false, isActive: true,
    searchAliases: ["猎犬座α", "Alpha Canum Venaticorum"],
  },
  {
    slug: "kochab", nameZh: "帝", nameEn: "Kochab",
    raHours: 14.8451, decDeg: 74.1555, magnitude: 2.08,
    isDetailReady: false, isActive: true,
    searchAliases: ["小熊座β", "Beta Ursae Minoris"],
  },
  {
    slug: "pherkad", nameZh: "小熊座γ", nameEn: "Pherkad",
    raHours: 15.3455, decDeg: 71.8347, magnitude: 3.05,
    isDetailReady: false, isActive: true,
    searchAliases: ["小熊座γ", "Gamma Ursae Minoris"],
  },
  {
    slug: "caph", nameZh: "王良五", nameEn: "Caph",
    raHours: 0.1529, decDeg: 59.1498, magnitude: 2.27,
    isDetailReady: false, isActive: true,
    searchAliases: ["仙后座β", "Beta Cassiopeiae"],
  },
  {
    slug: "schedar", nameZh: "王良四", nameEn: "Schedar",
    raHours: 0.6751, decDeg: 56.5373, magnitude: 2.24,
    isDetailReady: false, isActive: true,
    searchAliases: ["仙后座α", "Alpha Cassiopeiae"],
  },
  {
    slug: "navi", nameZh: "王良三", nameEn: "Navi",
    raHours: 0.9451, decDeg: 60.7167, magnitude: 2.15,
    isDetailReady: false, isActive: true,
    searchAliases: ["仙后座γ", "Gamma Cassiopeiae"],
  },
  {
    slug: "ruchbah", nameZh: "王良二", nameEn: "Ruchbah",
    raHours: 1.4303, decDeg: 60.2353, magnitude: 2.68,
    isDetailReady: false, isActive: true,
    searchAliases: ["仙后座δ", "Delta Cassiopeiae"],
  },
  {
    slug: "sadr", nameZh: "天津一", nameEn: "Sadr",
    raHours: 20.3705, decDeg: 40.2567, magnitude: 2.23,
    isDetailReady: false, isActive: true,
    searchAliases: ["天鹅座γ", "Gamma Cygni"],
  },
  {
    slug: "eltanin", nameZh: "天龙座γ", nameEn: "Eltanin",
    raHours: 17.9434, decDeg: 51.4889, magnitude: 2.23,
    isDetailReady: false, isActive: true,
    searchAliases: ["天龙座γ", "Gamma Draconis"],
  },
  {
    slug: "rastaban", nameZh: "天龙座β", nameEn: "Rastaban",
    raHours: 17.5072, decDeg: 52.3014, magnitude: 2.79,
    isDetailReady: false, isActive: true,
    searchAliases: ["天龙座β", "Beta Draconis"],
  },
  {
    slug: "tarazed", nameZh: "河鼓三", nameEn: "Tarazed",
    raHours: 19.7710, decDeg: 10.6133, magnitude: 2.72,
    isDetailReady: false, isActive: true,
    searchAliases: ["天鹰座γ", "Gamma Aquilae"],
  },
  {
    slug: "alderamin", nameZh: "少卫一", nameEn: "Alderamin",
    raHours: 21.3096, decDeg: 62.5855, magnitude: 2.51,
    isDetailReady: false, isActive: true,
    searchAliases: ["仙王座α", "Alpha Cephei"],
  },
  {
    slug: "algenib", nameZh: "壁宿一", nameEn: "Algenib",
    raHours: 0.2206, decDeg: 15.1836, magnitude: 2.84,
    isDetailReady: false, isActive: true,
    searchAliases: ["飞马座γ", "Gamma Pegasi"],
  },
  {
    slug: "sadalmelik", nameZh: "危宿一", nameEn: "Sadalmelik",
    raHours: 22.0964, decDeg: -0.3199, magnitude: 2.95,
    isDetailReady: false, isActive: true,
    searchAliases: ["宝瓶座α", "Alpha Aquarii"],
  },
  {
    slug: "sadalsuud", nameZh: "危宿二", nameEn: "Sadalsuud",
    raHours: 21.5259, decDeg: -5.5712, magnitude: 2.90,
    isDetailReady: false, isActive: true,
    searchAliases: ["宝瓶座β", "Beta Aquarii"],
  },
  {
    slug: "homam", nameZh: "飞马座ζ", nameEn: "Homam",
    raHours: 22.6910, decDeg: 9.8750, magnitude: 2.84,
    isDetailReady: false, isActive: true,
    searchAliases: ["飞马座ζ", "Zeta Pegasi"],
  },
  {
    slug: "rasalgethi", nameZh: "帝席", nameEn: "Rasalgethi",
    raHours: 17.2441, decDeg: 14.3903, magnitude: 2.81,
    isDetailReady: false, isActive: true,
    searchAliases: ["武仙座α", "Alpha Herculis"],
  },
  {
    slug: "nekkar", nameZh: "牧夫座β", nameEn: "Nekkar",
    raHours: 15.0324, decDeg: 40.3906, magnitude: 3.49,
    isDetailReady: false, isActive: true,
    searchAliases: ["牧夫座β", "Beta Boötis"],
  },
  {
    slug: "seginus", nameZh: "牧夫座γ", nameEn: "Seginus",
    raHours: 14.5346, decDeg: 38.3083, magnitude: 3.04,
    isDetailReady: false, isActive: true,
    searchAliases: ["牧夫座γ", "Gamma Boötis"],
  },
  {
    slug: "princeps", nameZh: "牧夫座δ", nameEn: "Princeps",
    raHours: 15.2584, decDeg: 33.3148, magnitude: 3.46,
    isDetailReady: false, isActive: true,
    searchAliases: ["牧夫座δ", "Delta Boötis"],
  },
  {
    slug: "wasat", nameZh: "双子座δ", nameEn: "Wasat",
    raHours: 7.3354, decDeg: 21.9823, magnitude: 3.53,
    isDetailReady: false, isActive: true,
    searchAliases: ["双子座δ", "Delta Geminorum"],
  },
  {
    slug: "mekbuda", nameZh: "双子座ζ", nameEn: "Mekbuda",
    raHours: 7.0685, decDeg: 20.5703, magnitude: 3.93,
    isDetailReady: false, isActive: true,
    searchAliases: ["双子座ζ", "Zeta Geminorum"],
  },
  {
    slug: "segin", nameZh: "仙后座ε", nameEn: "Segin",
    raHours: 1.9066, decDeg: 63.6700, magnitude: 3.35,
    isDetailReady: false, isActive: true,
    searchAliases: ["仙后座ε", "Epsilon Cassiopeiae"],
  },
  {
    slug: "achird", nameZh: "仙后座η", nameEn: "Achird",
    raHours: 0.8165, decDeg: 57.8153, magnitude: 3.44,
    isDetailReady: false, isActive: true,
    searchAliases: ["仙后座η", "Eta Cassiopeiae"],
  },
  {
    slug: "albireo", nameZh: "天鹅座β", nameEn: "Albireo",
    raHours: 19.5120, decDeg: 27.9597, magnitude: 3.05,
    isDetailReady: false, isActive: true,
    searchAliases: ["天鹅座β", "Beta Cygni"],
  },
  {
    slug: "gienah-cygni", nameZh: "天鹅座ε", nameEn: "Gienah",
    raHours: 20.7702, decDeg: 33.9703, magnitude: 2.48,
    isDetailReady: false, isActive: true,
    searchAliases: ["天鹅座ε", "Epsilon Cygni"],
  },
  {
    slug: "delta-cygni", nameZh: "天鹅座δ", nameEn: "Delta Cygni",
    raHours: 19.7496, decDeg: 45.1308, magnitude: 2.87,
    isDetailReady: false, isActive: true,
    searchAliases: ["天鹅座δ", "Delta Cygni"],
  },
  {
    slug: "lesath", nameZh: "尾宿七", nameEn: "Lesath",
    raHours: 17.5127, decDeg: -37.2958, magnitude: 2.69,
    isDetailReady: false, isActive: true,
    searchAliases: ["天蝎座υ", "Upsilon Scorpii"],
  },
  {
    slug: "delta-andromedae", nameZh: "仙女座δ", nameEn: "Delta Andromedae",
    raHours: 0.6555, decDeg: 30.8610, magnitude: 3.27,
    isDetailReady: false, isActive: true,
    searchAliases: ["仙女座δ", "Delta Andromedae"],
  },
  {
    slug: "zeta-leonis", nameZh: "狮子座ζ", nameEn: "Zeta Leonis",
    raHours: 10.2782, decDeg: 23.4173, magnitude: 3.44,
    isDetailReady: false, isActive: true,
    searchAliases: ["狮子座ζ", "Zeta Leonis"],
  },
  {
    slug: "nusakan", nameZh: "北冕座β", nameEn: "Nusakan",
    raHours: 15.4638, decDeg: 29.1053, magnitude: 3.68,
    isDetailReady: false, isActive: true,
    searchAliases: ["北冕座β", "Beta Coronae Borealis"],
  },
  {
    slug: "gamma-coronae-borealis", nameZh: "北冕座γ", nameEn: "Gamma Coronae Borealis",
    raHours: 15.7124, decDeg: 26.2956, magnitude: 3.81,
    isDetailReady: false, isActive: true,
    searchAliases: ["北冕座γ", "Gamma Coronae Borealis"],
  },
  {
    slug: "delta-coronae-borealis", nameZh: "北冕座δ", nameEn: "Delta Coronae Borealis",
    raHours: 15.8266, decDeg: 26.0685, magnitude: 4.63,
    isDetailReady: false, isActive: true,
    searchAliases: ["北冕座δ", "Delta Coronae Borealis"],
  },
  // ---- V4 扩容：进入星座视图后显示的成员恒星 ----
  {
    slug: "meissa", nameZh: "参宿八", nameEn: "Meissa",
    raHours: 5.5856, decDeg: 9.9342, magnitude: 3.39,
    isDetailReady: false, isActive: true,
    searchAliases: ["猎户座λ", "Lambda Orionis"],
  },
  {
    slug: "tania-borealis", nameZh: "大熊座λ", nameEn: "Tania Borealis",
    raHours: 10.2847, decDeg: 42.9144, magnitude: 3.45,
    isDetailReady: false, isActive: true,
    searchAliases: ["大熊座λ", "Lambda Ursae Majoris"],
  },
  {
    slug: "tania-australis", nameZh: "大熊座μ", nameEn: "Tania Australis",
    raHours: 10.3726, decDeg: 41.4994, magnitude: 3.17,
    isDetailReady: false, isActive: true,
    searchAliases: ["大熊座μ", "Mu Ursae Majoris"],
  },
  {
    slug: "alula-borealis", nameZh: "大熊座ν", nameEn: "Alula Borealis",
    raHours: 11.0307, decDeg: 31.5292, magnitude: 3.49,
    isDetailReady: false, isActive: true,
    searchAliases: ["大熊座ν", "Nu Ursae Majoris"],
  },
  {
    slug: "tejat-prior", nameZh: "井宿二", nameEn: "Tejat Prior",
    raHours: 6.3827, decDeg: 22.5136, magnitude: 2.87,
    isDetailReady: false, isActive: true,
    searchAliases: ["双子座μ", "Mu Geminorum"],
  },
  {
    slug: "mebsuta", nameZh: "井宿一", nameEn: "Mebsuta",
    raHours: 6.7322, decDeg: 25.1311, magnitude: 2.98,
    isDetailReady: false, isActive: true,
    searchAliases: ["双子座ε", "Epsilon Geminorum"],
  },
  {
    slug: "propus", nameZh: "井宿四", nameEn: "Propus",
    raHours: 6.2476, decDeg: 22.5068, magnitude: 3.31,
    isDetailReady: false, isActive: true,
    searchAliases: ["双子座η", "Eta Geminorum"],
  },
  {
    slug: "jabbah", nameZh: "房宿一", nameEn: "Jabbah",
    raHours: 16.0728, decDeg: -19.8054, magnitude: 2.99,
    isDetailReady: false, isActive: true,
    searchAliases: ["天蝎座ν", "Nu Scorpii"],
  },
  {
    slug: "fang", nameZh: "心宿一", nameEn: "Fang",
    raHours: 16.8360, decDeg: -34.2932, magnitude: 2.89,
    isDetailReady: false, isActive: true,
    searchAliases: ["天蝎座π", "Pi Scorpii"],
  },
  {
    slug: "girtab", nameZh: "尾宿六", nameEn: "Girtab",
    raHours: 17.7080, decDeg: -39.0300, magnitude: 2.39,
    isDetailReady: false, isActive: true,
    searchAliases: ["天蝎座κ", "Kappa Scorpii"],
  },
  {
    slug: "upsilon-andromedae", nameZh: "仙女座υ", nameEn: "Upsilon Andromedae",
    raHours: 1.6133, decDeg: 41.4055, magnitude: 4.10,
    isDetailReady: false, isActive: true,
    searchAliases: ["仙女座υ", "Upsilon Andromedae"],
  },
  {
    slug: "iota-andromedae", nameZh: "仙女座ι", nameEn: "Iota Andromedae",
    raHours: 23.6367, decDeg: 43.2681, magnitude: 4.29,
    isDetailReady: false, isActive: true,
    searchAliases: ["仙女座ι", "Iota Andromedae"],
  },
  {
    slug: "zosma", nameZh: "太微右垣一", nameEn: "Zosma",
    raHours: 11.2351, decDeg: 20.5237, magnitude: 2.56,
    isDetailReady: false, isActive: true,
    searchAliases: ["狮子座δ", "Delta Leonis"],
  },
  {
    slug: "chertan", nameZh: "太微右垣三", nameEn: "Chertan",
    raHours: 11.2373, decDeg: 15.4296, magnitude: 3.33,
    isDetailReady: false, isActive: true,
    searchAliases: ["狮子座θ", "Theta Leonis"],
  },
  {
    slug: "eta-leonis", nameZh: "狮子座η", nameEn: "Eta Leonis",
    raHours: 10.1222, decDeg: 16.7627, magnitude: 3.51,
    isDetailReady: false, isActive: true,
    searchAliases: ["狮子座η", "Eta Leonis"],
  },
  {
    slug: "epsilon-coronae-borealis", nameZh: "北冕座ε", nameEn: "Epsilon Coronae Borealis",
    raHours: 15.9598, decDeg: 26.8779, magnitude: 4.13,
    isDetailReady: false, isActive: true,
    searchAliases: ["北冕座ε", "Epsilon Coronae Borealis"],
  },
  {
    slug: "theta-coronae-borealis", nameZh: "北冕座θ", nameEn: "Theta Coronae Borealis",
    raHours: 15.5480, decDeg: 31.3590, magnitude: 4.14,
    isDetailReady: false, isActive: true,
    searchAliases: ["北冕座θ", "Theta Coronae Borealis"],
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
