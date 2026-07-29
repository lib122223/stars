export type BodyMapSlug = "moon" | "mars" | "mercury";

export type BodyFeatureCategory =
  | "mare"
  | "crater"
  | "mountain"
  | "valley"
  | "volcano"
  | "canyon"
  | "basin"
  | "plain"
  | "scarp"
  | "polar";

export interface BodyFeature {
  id: string;
  nameZh: string;
  nameEn: string;
  category: BodyFeatureCategory;
  lat: number;
  lon: number;
  size: "sm" | "md" | "lg";
  description: string;
}

export interface BodyMapConfig {
  slug: BodyMapSlug;
  nameZh: string;
  nameEn: string;
  subtitle: string;
  texture: string;
  sourceLabel: string;
  sourceUrl: string;
  radiusKm: number;
  defaultCamera: [number, number, number];
  initialRotation: [number, number, number];
  categories: BodyFeatureCategory[];
  features: BodyFeature[];
}

export const featureCategoryLabels: Record<BodyFeatureCategory, string> = {
  mare: "海 / 湾 / 湖",
  crater: "陨石坑",
  mountain: "山脉",
  valley: "月谷 / 谷地",
  volcano: "火山",
  canyon: "峡谷",
  basin: "盆地",
  plain: "平原",
  scarp: "断崖",
  polar: "极区",
};

export const featureCategoryColors: Record<BodyFeatureCategory, string> = {
  mare: "#25d6d2",
  crater: "#ff5f67",
  mountain: "#f3d64e",
  valley: "#55dfa7",
  volcano: "#ff9c49",
  canyon: "#d78cff",
  basin: "#55c7ff",
  plain: "#7ee787",
  scarp: "#ffd166",
  polar: "#b7d7ff",
};

export const bodyMaps: Record<BodyMapSlug, BodyMapConfig> = {
  moon: {
    slug: "moon",
    nameZh: "月球",
    nameEn: "Moon",
    subtitle: "月海、环形山、山脉与月谷",
    texture: "/assets/body-map/moon.jpg",
    sourceLabel: "Moon texture from THREEx Planets / public astronomy texture set",
    sourceUrl: "https://github.com/jeromeetienne/threex.planets",
    radiusKm: 1737.4,
    defaultCamera: [0, 0.25, 3.1],
    initialRotation: [0.08, -0.35, 0],
    categories: ["mare", "crater", "mountain", "valley"],
    features: [
      { id: "mare-imbrium", nameZh: "雨海", nameEn: "Mare Imbrium", category: "mare", lat: 32.8, lon: -15.6, size: "lg", description: "月球近月面西北部的大型撞击盆地，周边分布有阿尔卑斯山脉、高加索山脉和亚平宁山脉。" },
      { id: "mare-serenitatis", nameZh: "澄海", nameEn: "Mare Serenitatis", category: "mare", lat: 28.0, lon: 17.5, size: "lg", description: "近月面北部的圆形月海，与静海、雨海共同构成肉眼可见的暗色区域。" },
      { id: "mare-tranquillitatis", nameZh: "静海", nameEn: "Mare Tranquillitatis", category: "mare", lat: 8.5, lon: 31.4, size: "lg", description: "阿波罗 11 号着陆区所在的月海，是月球正面最容易识别的暗色区域之一。" },
      { id: "mare-crisium", nameZh: "危海", nameEn: "Mare Crisium", category: "mare", lat: 17.0, lon: 59.1, size: "lg", description: "近月面东侧边缘的孤立月海，圆形边界清晰。" },
      { id: "oceanus-procellarum", nameZh: "风暴洋", nameEn: "Oceanus Procellarum", category: "mare", lat: 18.4, lon: -57.4, size: "lg", description: "月球最大的暗色玄武岩平原，不是封闭圆形盆地，因此称为“洋”。" },
      { id: "mare-nectaris", nameZh: "酒海", nameEn: "Mare Nectaris", category: "mare", lat: -15.2, lon: 35.5, size: "md", description: "位于近月面东南部的小型月海，周围有明显环形山地貌。" },
      { id: "mare-humorum", nameZh: "湿海", nameEn: "Mare Humorum", category: "mare", lat: -24.4, lon: -38.6, size: "md", description: "近月面西南部圆形月海，边缘山地和裂谷结构较丰富。" },
      { id: "mare-frigoris", nameZh: "冷海", nameEn: "Mare Frigoris", category: "mare", lat: 56.0, lon: 1.4, size: "md", description: "月球北部横向延伸的暗色月海，位置接近高纬度。" },
      { id: "copernicus", nameZh: "哥白尼环形山", nameEn: "Copernicus", category: "crater", lat: 9.7, lon: -20.0, size: "md", description: "年轻的大型环形山，辐射纹明显，是望远镜中很醒目的月面目标。" },
      { id: "tycho", nameZh: "第谷环形山", nameEn: "Tycho", category: "crater", lat: -43.3, lon: -11.2, size: "md", description: "南半球著名年轻环形山，满月时辐射纹横跨月面。" },
      { id: "plato", nameZh: "柏拉图环形山", nameEn: "Plato", category: "crater", lat: 51.6, lon: -9.3, size: "md", description: "雨海北缘的大型暗底环形山，内部平坦且颜色较暗。" },
      { id: "clavius", nameZh: "克拉维斯环形山", nameEn: "Clavius", category: "crater", lat: -58.4, lon: -14.4, size: "lg", description: "月球南部大型古老环形山，内部有一串逐渐变小的子坑。" },
      { id: "aristarchus", nameZh: "阿里斯塔克斯环形山", nameEn: "Aristarchus", category: "crater", lat: 23.7, lon: -47.4, size: "md", description: "月面最亮区域之一，位于风暴洋附近。" },
      { id: "montes-apenninus", nameZh: "亚平宁山脉", nameEn: "Montes Apenninus", category: "mountain", lat: 19.9, lon: -3.7, size: "lg", description: "雨海东南缘的弧形山脉，是月球正面最醒目的山脉结构之一。" },
      { id: "montes-alpes", nameZh: "阿尔卑斯山脉", nameEn: "Montes Alpes", category: "mountain", lat: 46.4, lon: 0.6, size: "md", description: "雨海北缘山脉，中间穿过著名的阿尔卑斯月谷。" },
      { id: "montes-caucasus", nameZh: "高加索山脉", nameEn: "Montes Caucasus", category: "mountain", lat: 38.4, lon: 10.0, size: "md", description: "位于雨海和澄海之间的山脉。" },
      { id: "vallis-alpes", nameZh: "阿尔卑斯月谷", nameEn: "Vallis Alpes", category: "valley", lat: 48.5, lon: 3.2, size: "md", description: "穿过阿尔卑斯山脉的狭长月谷，望远镜下形态清晰。" },
      { id: "vallis-schroteri", nameZh: "施罗特月谷", nameEn: "Vallis Schroteri", category: "valley", lat: 26.2, lon: -50.8, size: "md", description: "风暴洋附近的弯曲月谷，位于阿里斯塔克斯高原区域。" },
    ],
  },
  mars: {
    slug: "mars",
    nameZh: "火星",
    nameEn: "Mars",
    subtitle: "火山、峡谷、盆地、平原与极冠",
    texture: "/assets/body-map/mars.jpg",
    sourceLabel: "Solar System Scope 2K Mars texture",
    sourceUrl: "https://www.solarsystemscope.com/textures/",
    radiusKm: 3389.5,
    defaultCamera: [0, 0.22, 3.2],
    initialRotation: [0.05, -1.0, 0],
    categories: ["volcano", "canyon", "basin", "plain", "crater", "polar"],
    features: [
      { id: "olympus-mons", nameZh: "奥林帕斯山", nameEn: "Olympus Mons", category: "volcano", lat: 18.65, lon: -133.8, size: "lg", description: "太阳系已知最高的火山之一，位于塔尔西斯高原西北侧。" },
      { id: "arsia-mons", nameZh: "阿尔西亚山", nameEn: "Arsia Mons", category: "volcano", lat: -8.4, lon: -120.1, size: "md", description: "塔尔西斯三大盾状火山之一，位于三座火山的南端。" },
      { id: "pavonis-mons", nameZh: "帕弗尼斯山", nameEn: "Pavonis Mons", category: "volcano", lat: 0.8, lon: -112.8, size: "md", description: "塔尔西斯三大盾状火山中间的一座，接近火星赤道。" },
      { id: "ascraeus-mons", nameZh: "阿斯克雷乌斯山", nameEn: "Ascraeus Mons", category: "volcano", lat: 11.9, lon: -104.5, size: "md", description: "塔尔西斯三大盾状火山北端的一座。" },
      { id: "elysium-mons", nameZh: "埃律西昂山", nameEn: "Elysium Mons", category: "volcano", lat: 25.0, lon: 147.0, size: "md", description: "火星埃律西昂火山区的主要火山。" },
      { id: "valles-marineris", nameZh: "水手谷", nameEn: "Valles Marineris", category: "canyon", lat: -14.0, lon: -59.0, size: "lg", description: "横跨火星赤道附近的巨型峡谷系统，尺度远超地球大峡谷。" },
      { id: "noctis-labyrinthus", nameZh: "夜迷宫", nameEn: "Noctis Labyrinthus", category: "canyon", lat: -7.0, lon: -102.0, size: "md", description: "由断裂谷和塌陷地形组成的复杂区域，位于水手谷西端。" },
      { id: "hellas-planitia", nameZh: "希腊平原", nameEn: "Hellas Planitia", category: "basin", lat: -42.4, lon: 70.5, size: "lg", description: "火星南半球巨型撞击盆地，是火星最低洼的大尺度地形之一。" },
      { id: "argyre-planitia", nameZh: "阿耳古瑞平原", nameEn: "Argyre Planitia", category: "basin", lat: -49.7, lon: -43.0, size: "lg", description: "南半球大型撞击盆地，周边环绕山地结构。" },
      { id: "utopia-planitia", nameZh: "乌托邦平原", nameEn: "Utopia Planitia", category: "plain", lat: 46.7, lon: 118.0, size: "lg", description: "北半球大型低地平原，多个探测任务曾关注该区域。" },
      { id: "syrtis-major", nameZh: "大瑟提斯高原", nameEn: "Syrtis Major Planum", category: "plain", lat: 8.4, lon: 69.5, size: "md", description: "火星表面最早被望远镜发现的暗色区域之一。" },
      { id: "gale-crater", nameZh: "盖尔陨石坑", nameEn: "Gale Crater", category: "crater", lat: -5.4, lon: 137.8, size: "md", description: "好奇号火星车着陆区，中央有夏普山。" },
      { id: "jezero-crater", nameZh: "杰泽罗陨石坑", nameEn: "Jezero Crater", category: "crater", lat: 18.4, lon: 77.6, size: "md", description: "毅力号火星车着陆区，保存有古三角洲沉积地貌。" },
      { id: "north-polar-cap", nameZh: "北极冠", nameEn: "North Polar Cap", category: "polar", lat: 85.0, lon: 0.0, size: "md", description: "火星北极冰盖区域，随季节变化明显。" },
      { id: "south-polar-cap", nameZh: "南极冠", nameEn: "South Polar Cap", category: "polar", lat: -85.0, lon: 0.0, size: "md", description: "火星南极冰盖区域，包含水冰和二氧化碳冰。" },
    ],
  },
  mercury: {
    slug: "mercury",
    nameZh: "水星",
    nameEn: "Mercury",
    subtitle: "盆地、陨石坑、断崖与平原",
    texture: "/assets/body-map/mercury.jpg",
    sourceLabel: "Solar System Scope 2K Mercury texture",
    sourceUrl: "https://www.solarsystemscope.com/textures/",
    radiusKm: 2439.7,
    defaultCamera: [0, 0.2, 3.15],
    initialRotation: [0.08, -0.8, 0],
    categories: ["basin", "crater", "scarp", "plain"],
    features: [
      { id: "caloris-basin", nameZh: "卡洛里盆地", nameEn: "Caloris Basin", category: "basin", lat: 30.5, lon: 162.7, size: "lg", description: "水星最大的撞击盆地之一，周围分布有环状山脉和平原。" },
      { id: "rembrandt-basin", nameZh: "伦勃朗盆地", nameEn: "Rembrandt Basin", category: "basin", lat: -32.9, lon: 87.9, size: "lg", description: "水星南半球大型撞击盆地，内部保留有褶皱和断裂结构。" },
      { id: "beethoven-basin", nameZh: "贝多芬盆地", nameEn: "Beethoven Basin", category: "basin", lat: -20.8, lon: -123.4, size: "lg", description: "水星西半球大型撞击盆地，以作曲家贝多芬命名。" },
      { id: "tolstoj-basin", nameZh: "托尔斯泰盆地", nameEn: "Tolstoj Basin", category: "basin", lat: -16.0, lon: 164.0, size: "md", description: "靠近卡洛里盆地的古老撞击盆地。" },
      { id: "rachmaninoff-basin", nameZh: "拉赫玛尼诺夫盆地", nameEn: "Rachmaninoff Basin", category: "basin", lat: 27.6, lon: 57.6, size: "md", description: "内部有较年轻的火山平原，是 MESSENGER 任务关注的区域之一。" },
      { id: "kuiper-crater", nameZh: "柯伊伯陨石坑", nameEn: "Kuiper Crater", category: "crater", lat: -11.4, lon: -31.5, size: "md", description: "水星上较年轻且明亮的陨石坑，具有明显射纹。" },
      { id: "hokusai-crater", nameZh: "北斋陨石坑", nameEn: "Hokusai Crater", category: "crater", lat: 57.8, lon: 16.8, size: "md", description: "具有长距离射纹系统的年轻陨石坑。" },
      { id: "degas-crater", nameZh: "德加陨石坑", nameEn: "Degas Crater", category: "crater", lat: 37.5, lon: -126.7, size: "md", description: "明亮射纹环形山，以法国画家德加命名。" },
      { id: "debussey-crater", nameZh: "德彪西陨石坑", nameEn: "Debussy Crater", category: "crater", lat: 33.9, lon: -13.0, size: "md", description: "年轻大型射纹坑，射纹在水星表面延伸很远。" },
      { id: "discovery-rupes", nameZh: "发现号断崖", nameEn: "Discovery Rupes", category: "scarp", lat: -56.3, lon: 38.3, size: "md", description: "水星收缩造成的长距离断崖地貌，是水星构造活动的典型证据。" },
      { id: "enterprise-rupes", nameZh: "进取号断崖", nameEn: "Enterprise Rupes", category: "scarp", lat: -36.5, lon: -73.0, size: "md", description: "水星表面的弧形断崖，反映全球冷却收缩历史。" },
      { id: "victoria-rupes", nameZh: "维多利亚断崖", nameEn: "Victoria Rupes", category: "scarp", lat: -13.5, lon: -33.0, size: "md", description: "水星典型断崖结构之一，横切多个古老地貌单元。" },
      { id: "borealis-planitia", nameZh: "北方平原", nameEn: "Borealis Planitia", category: "plain", lat: 73.0, lon: -80.0, size: "lg", description: "水星北部的大范围平原区域。" },
      { id: "suisei-planitia", nameZh: "彗星平原", nameEn: "Suisei Planitia", category: "plain", lat: 60.0, lon: -150.0, size: "md", description: "水星高纬区域平原地貌之一。" },
    ],
  },
};

export function getBodyMapConfig(slug: string): BodyMapConfig | null {
  if (slug === "moon" || slug === "mars" || slug === "mercury") {
    return bodyMaps[slug];
  }
  return null;
}
