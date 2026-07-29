import { commonsFile, commonsImage, type AstronomyImageSource } from "@/lib/astronomy/image-sources";

export type SkyGalleryCategory = "机构深空" | "银河地景" | "行星月面" | "星座星野";

export interface SkyGalleryImage {
  id: string;
  title: string;
  category: SkyGalleryCategory;
  description: string;
  image: AstronomyImageSource;
  src: string;
  alt: string;
}

function item(
  id: string,
  title: string,
  category: SkyGalleryCategory,
  description: string,
  image: AstronomyImageSource,
): SkyGalleryImage {
  return {
    id,
    title,
    category,
    description,
    image,
    src: commonsFile(image.file, 950),
    alt: title,
  };
}

export const skyGalleryImages: SkyGalleryImage[] = [
  item(
    "milky-way-sagittarius",
    "银河与人马座方向",
    "银河地景",
    "宽视场银河摄影，适合建立真实夜空密度和银河带氛围的参考。",
    commonsImage("The Milky Way and Sagittarius Constellation (opo9930e).jpg", {
      credit: "Terrence Dickinson / ESA-Hubble",
      location: "Milky Way toward Sagittarius",
      capturedAt: "1999",
      equipment: "Wide-field astrophotography",
      license: "Public domain / see source page",
    }),
  ),
  item(
    "anji-starry-sky",
    "安吉星空",
    "银河地景",
    "国内夜空地景样张，用来补充本土观测场景的氛围参考。",
    commonsImage("Anji County Starry Sky.jpg", {
      credit: "Wikimedia Commons contributor",
      location: "Anji County, Zhejiang, China",
      capturedAt: "见来源页面",
      equipment: "Landscape astrophotography",
      license: "Wikimedia Commons / see source page",
    }),
  ),
  item(
    "orion-real-sky",
    "猎户座真实星野",
    "星座星野",
    "真实夜空中的猎户座，适合对照星座骨架和周围星点密度。",
    commonsImage("Orion - Clear night sky.jpg", {
      credit: "The359",
      location: "Eastern Pennsylvania, USA",
      capturedAt: "2007-11-08",
      equipment: "DSLR sky photograph",
      license: "Wikimedia Commons / CC BY-SA",
    }),
  ),
  item(
    "summer-triangle",
    "夏季大三角宽视场",
    "星座星野",
    "织女星、牛郎星、天津四所在区域的真实宽视场星野。",
    commonsImage("Wide-field view of the Summer Triangle.jpg", {
      credit: "A. Fujii / ESA-Hubble",
      location: "Summer Triangle sky field",
      capturedAt: "见来源页面",
      equipment: "Wide-field astrophotography",
      license: "ESA/Hubble source / see source page",
    }),
  ),
  item(
    "big-dipper",
    "北斗七星真实星野",
    "星座星野",
    "北斗区域的真实星野照片，用来对照明亮星组的视觉关系。",
    commonsImage("Big Dipper 20210116.jpg", {
      credit: "Wikimedia Commons contributor",
      location: "Northern sky field",
      capturedAt: "2021-01-16",
      equipment: "Night-sky photograph",
      license: "Wikimedia Commons / see source page",
    }),
  ),
  item(
    "orion-nebula",
    "猎户座大星云",
    "机构深空",
    "哈勃望远镜深空影像，展示星云本体结构和发光气体层次。",
    commonsImage("Orion Nebula - Hubble 2006 mosaic 18000.jpg", {
      credit: "NASA, ESA, M. Robberto (STScI/ESA), Hubble Space Telescope Orion Treasury Project Team",
      location: "Hubble Space Telescope observation",
      capturedAt: "2006",
      equipment: "Hubble Space Telescope",
      license: "NASA/ESA public outreach image / see source page",
    }),
  ),
  item(
    "andromeda",
    "仙女座星系",
    "机构深空",
    "星系整体摄影图，适合表现深空对象作为一个整体时的视觉价值。",
    commonsImage("Andromeda Galaxy (with h-alpha).jpg", {
      credit: "Adam Evans",
      location: "Deep-sky astrophotography",
      capturedAt: "见来源页面",
      equipment: "Telescope / astrophotography stack",
      license: "Wikimedia Commons / CC BY",
    }),
  ),
  item(
    "pillars-of-creation",
    "创生之柱",
    "机构深空",
    "鹰状星云内的经典恒星形成区，适合展示专业机构深空摄影。",
    commonsImage("Pillars of creation 2014 HST WFC3-UVIS full-res denoised.jpg", {
      credit: "NASA, ESA/Hubble and the Hubble Heritage Team",
      location: "Hubble Space Telescope observation",
      capturedAt: "2014",
      equipment: "Hubble Space Telescope WFC3",
      license: "NASA/ESA public outreach image / see source page",
    }),
  ),
  item(
    "ngc-1300",
    "棒旋星系 NGC 1300",
    "机构深空",
    "哈勃拍摄的棒旋星系，补充星系结构类影像。",
    commonsImage("Hubble2005-01-barred-spiral-galaxy-NGC1300.jpg", {
      credit: "NASA, ESA, and The Hubble Heritage Team",
      location: "Hubble Space Telescope observation",
      capturedAt: "2005",
      equipment: "Hubble Space Telescope",
      license: "NASA/ESA public outreach image / see source page",
    }),
  ),
  item(
    "jupiter",
    "木星云带",
    "行星月面",
    "行星本体影像，展示肉眼亮点背后的真实圆面结构。",
    commonsImage("Jupiter by Cassini-Huygens.jpg", {
      credit: "NASA/JPL/Space Science Institute",
      location: "Cassini spacecraft observation",
      capturedAt: "2000-12",
      equipment: "Cassini spacecraft camera",
      license: "NASA public domain / see source page",
    }),
  ),
  item(
    "saturn",
    "土星与光环",
    "行星月面",
    "行星本体影像，展示需要望远镜或航天器才能分辨的光环结构。",
    commonsImage("Saturn during Equinox.jpg", {
      credit: "NASA/JPL/Space Science Institute",
      location: "Cassini spacecraft observation",
      capturedAt: "2009",
      equipment: "Cassini spacecraft camera",
      license: "NASA public domain / see source page",
    }),
  ),
  item(
    "moon",
    "满月月面",
    "行星月面",
    "地基月面摄影，展示月球本体纹理和明暗区域。",
    commonsImage("FullMoon2010.jpg", {
      credit: "Gregory H. Revera",
      location: "Earth-based lunar photograph",
      capturedAt: "2010",
      equipment: "Telescope / camera",
      license: "Wikimedia Commons / CC BY-SA",
    }),
  ),
];
