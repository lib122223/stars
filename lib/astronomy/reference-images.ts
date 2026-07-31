import { commonsFile, commonsImage, nasaFile, nasaImage, type AstronomyImageSource } from "@/lib/astronomy/image-sources";

export type ReferenceImageKind = "object_photo";

export interface ReferenceImageMeta {
  credit: string;
  location: string;
  capturedAt: string;
  equipment: string;
  license: string;
  sourceUrl: string;
}

export interface ReferenceImage {
  id: string;
  kind: ReferenceImageKind;
  title: string;
  description: string;
  meta: ReferenceImageMeta;
  src: string;
  alt: string;
}

interface ObjectRefInput {
  slug: string;
  nameZh: string;
  nameEn: string;
  objectType: string;
}

interface ObjectImageConfig {
  image: AstronomyImageSource;
  description: string;
  src?: string;
}

const objectImagesBySlug: Record<string, ObjectImageConfig> = {
  mercury: {
    image: commonsImage("Mercury in true color.jpg", {
      credit: "NASA / Johns Hopkins University Applied Physics Laboratory / Carnegie Institution of Washington",
      location: "MESSENGER spacecraft observation",
      capturedAt: "见来源页面",
      equipment: "MESSENGER spacecraft camera",
      license: "NASA public domain / see source page",
    }),
    description: "航天器真实影像，用来展示水星本体颜色和布满陨石坑的表面；现场肉眼通常只看到接近日出日落方向的微亮点。",
  },
  earth: {
    image: commonsImage("The Earth seen from Apollo 17.jpg", {
      credit: "NASA / Apollo 17 crew",
      location: "Apollo 17 spacecraft observation",
      capturedAt: "1972-12-07",
      equipment: "Apollo spacecraft camera",
      license: "NASA public domain / see source page",
    }),
    description: "航天器真实影像，用来展示地球本体的云层、海洋和大陆轮廓。",
  },
  jupiter: {
    image: commonsImage("Jupiter by Cassini-Huygens.jpg", {
      credit: "NASA/JPL/Space Science Institute",
      location: "Cassini spacecraft observation",
      capturedAt: "2000-12",
      equipment: "Cassini spacecraft camera",
      license: "NASA public domain / see source page",
    }),
    description: "航天器真实影像，用来展示木星本体的云带、颜色和圆面特征；现场肉眼仍主要看到稳定的亮点。",
  },
  venus: {
    image: commonsImage("Venus-real color.jpg", {
      credit: "NASA / JPL",
      location: "Spacecraft composite observation",
      capturedAt: "见来源页面",
      equipment: "Spacecraft imaging",
      license: "NASA public domain / see source page",
    }),
    description: "航天器真实影像，用来展示金星整体外观；现场肉眼主要看到极亮的点状光源或相位变化。",
  },
  mars: {
    image: commonsImage("OSIRIS Mars true color.jpg", {
      credit: "ESA / Rosetta / OSIRIS Team",
      location: "Rosetta spacecraft observation",
      capturedAt: "2007-02",
      equipment: "OSIRIS camera",
      license: "ESA source / see source page",
    }),
    description: "航天器真实影像，用来展示火星圆面、颜色和表面明暗差异；现场肉眼通常呈偏橙红色亮点。",
  },
  saturn: {
    image: commonsImage("Saturn during Equinox.jpg", {
      credit: "NASA/JPL/Space Science Institute",
      location: "Cassini spacecraft observation",
      capturedAt: "2009",
      equipment: "Cassini spacecraft camera",
      license: "NASA public domain / see source page",
    }),
    description: "航天器真实影像，用来展示土星本体和光环；现场肉眼不能直接分辨光环，需要望远镜。",
  },
  uranus: {
    image: commonsImage("Uranus2.jpg", {
      credit: "NASA / JPL",
      location: "Voyager 2 spacecraft observation",
      capturedAt: "1986",
      equipment: "Voyager 2 spacecraft camera",
      license: "NASA public domain / see source page",
    }),
    description: "航天器真实影像，用来展示天王星本体的蓝绿色圆面；现场肉眼极难直接分辨。",
  },
  neptune: {
    image: commonsImage("Neptune Full.jpg", {
      credit: "NASA / JPL",
      location: "Voyager 2 spacecraft observation",
      capturedAt: "1989",
      equipment: "Voyager 2 spacecraft camera",
      license: "NASA public domain / see source page",
    }),
    description: "航天器真实影像，用来展示海王星本体颜色和圆面；现场肉眼不可见，需要望远镜或摄影设备。",
  },
  moon: {
    image: commonsImage("FullMoon2010.jpg", {
      credit: "Gregory H. Revera",
      location: "Earth-based lunar photograph",
      capturedAt: "2010",
      equipment: "Telescope / camera",
      license: "Wikimedia Commons / CC BY-SA",
    }),
    description: "真实月面照片，用来展示月球本体纹理和明暗区域；实际细节会随月相、天气和设备变化。",
  },
  sun: {
    image: commonsImage("The Sun by the Atmospheric Imaging Assembly of NASA's Solar Dynamics Observatory - 20100819.jpg", {
      credit: "NASA / SDO / AIA",
      location: "Solar Dynamics Observatory",
      capturedAt: "2010-08-19",
      equipment: "Solar Dynamics Observatory",
      license: "NASA public domain / see source page",
    }),
    description: "太阳观测卫星影像，用来展示太阳本体活动结构；实际观测必须使用合规太阳滤镜。",
  },
  "andromeda-galaxy": {
    image: commonsImage("Andromeda Galaxy (with h-alpha).jpg", {
      credit: "Adam Evans",
      location: "Deep-sky astrophotography",
      capturedAt: "见来源页面",
      equipment: "Telescope / astrophotography stack",
      license: "Wikimedia Commons / CC BY",
    }),
    description: "星系是整体深空对象，摄影图能表达对象本体结构，因此保留在详情页本体影像中。",
  },
  "orion-nebula": {
    image: commonsImage("Orion Nebula - Hubble 2006 mosaic 18000.jpg", {
      credit: "NASA, ESA, M. Robberto (STScI/ESA) and the Hubble Space Telescope Orion Treasury Project Team",
      location: "Hubble Space Telescope observation",
      capturedAt: "2006",
      equipment: "Hubble Space Telescope",
      license: "NASA/ESA public outreach image / see source page",
    }),
    description: "星云是整体深空对象，摄影图能表达对象本体结构，因此保留在详情页本体影像中。",
  },
  "triangulum-galaxy": {
    image: nasaImage("PIA11969", { location: "Triangulum Galaxy (M33)", equipment: "NASA space telescope observations" }),
    src: nasaFile("PIA11969"),
    description: "M33 的完整星系结构与恒星形成区域。",
  },
  "whirlpool-galaxy": {
    image: nasaImage("PIA10200", { location: "Whirlpool Galaxy (M51)", equipment: "Hubble Space Telescope" }),
    src: nasaFile("PIA10200"),
    description: "M51 的旋臂与伴星系相互作用结构。",
  },
  "sombrero-galaxy": {
    image: nasaImage("0700064", { location: "Sombrero Galaxy (M104)", equipment: "Hubble Space Telescope" }),
    src: nasaFile("0700064", "medium"),
    description: "M104 的横贯尘埃带与中央核球。",
  },
  "centaurus-a": {
    image: nasaImage("PIA04624", { location: "Centaurus A galaxy", equipment: "NASA space telescope observations" }),
    src: nasaFile("PIA04624", "medium"),
    description: "半人马座 A 的活动星系结构与尘埃带。",
  },
  "large-magellanic-cloud": {
    image: nasaImage("iss071e418742", { location: "Large Magellanic Cloud", equipment: "International Space Station camera" }),
    src: nasaFile("iss071e418742"),
    description: "从轨道观察大麦哲伦云与南天星区。",
  },
  "small-magellanic-cloud": {
    image: nasaImage("PIA25164", { location: "Small Magellanic Cloud", equipment: "Herschel, Planck, IRAS and COBE observations" }),
    src: nasaFile("PIA25164"),
    description: "小麦哲伦云的红外结构与星际尘埃。",
  },
  "lagoon-nebula": {
    image: nasaImage("GSFC_20171208_Archive_e001955", { location: "Lagoon Nebula (M8)", equipment: "Hubble Space Telescope" }),
    src: nasaFile("GSFC_20171208_Archive_e001955"),
    description: "人马座方向的发光气体云与恒星形成区。",
  },
  "ring-nebula": {
    image: nasaImage("PIA14443", { location: "Ring Nebula (M57)", equipment: "NASA space telescope observations" }),
    src: nasaFile("PIA14443", "small"),
    description: "环状星云的环形气体结构。",
  },
  "dumbbell-nebula": {
    image: nasaImage("PIA04249", { location: "Dumbbell Nebula (M27)", equipment: "NASA space telescope observations" }),
    src: nasaFile("PIA04249", "small"),
    description: "哑铃星云的双叶轮廓。",
  },
  pleiades: {
    image: nasaImage("PIA14096", { location: "Pleiades star cluster (M45)", equipment: "NASA infrared space telescope observations" }),
    src: nasaFile("PIA14096"),
    description: "昴星团的恒星成员与星际尘埃。",
  },
  hyades: {
    image: nasaImage("GSFC_20171208_Archive_e001500", { location: "Hyades star cluster", equipment: "Hubble Space Telescope" }),
    src: nasaFile("GSFC_20171208_Archive_e001500"),
    description: "毕星团成员星与星团视场。",
  },
  "omega-centauri": {
    image: nasaImage("PIA10372", { location: "Omega Centauri globular cluster", equipment: "NASA infrared space telescope observations" }),
    src: nasaFile("PIA10372", "medium"),
    description: "半人马座 Omega 球状星团的密集恒星结构。",
  },
};

function toReferenceImage(object: ObjectRefInput, config: ObjectImageConfig): ReferenceImage {
  return {
    id: `${object.slug}-object-photo`,
    kind: "object_photo",
    title: "本体真实影像",
    description: config.description,
    src: config.src ?? commonsFile(config.image.file, 1200),
    alt: `${object.nameZh} 本体真实影像`,
    meta: {
      credit: config.image.credit,
      location: config.image.location,
      capturedAt: config.image.capturedAt,
      equipment: config.image.equipment,
      license: config.image.license,
      sourceUrl: config.image.sourceUrl,
    },
  };
}

export function getReferenceImages(object: ObjectRefInput): ReferenceImage[] {
  const config = objectImagesBySlug[object.slug];
  if (config) {
    return [toReferenceImage(object, config)];
  }

  if (object.objectType === "planet" || object.objectType === "moon" || object.objectType === "sun") {
    return [];
  }

  if (["galaxy", "nebula", "cluster", "deep_sky"].includes(object.objectType)) {
    return [];
  }

  return [];
}
