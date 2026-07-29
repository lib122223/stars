export type CosmicObjectType =
  | "galaxy"
  | "nebula"
  | "open_cluster"
  | "globular_cluster";

export interface CosmicCatalogObject {
  slug: string;
  nameZh: string;
  nameEn: string;
  type: CosmicObjectType;
  raHours: number;
  decDeg: number;
  magnitude: number;
  visualSize: number;
  color: string;
  aliases: string[];
}

export interface PanoramaProjectionInput {
  raHours: number;
  decDeg: number;
  centerRaDeg: number;
  horizontalFovDeg: number;
  width: number;
  height: number;
  centerDecDeg?: number;
  verticalFovDeg?: number;
}

export function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function signedAngularDelta(value: number, center: number): number {
  return ((value - center + 540) % 360) - 180;
}

export function projectEquatorialToPanorama({
  raHours,
  decDeg,
  centerRaDeg,
  horizontalFovDeg,
  width,
  height,
  centerDecDeg = 0,
  verticalFovDeg = 180,
}: PanoramaProjectionInput): { x: number; y: number } {
  const deltaRa = signedAngularDelta(raHours * 15, centerRaDeg);
  return {
    x: width / 2 + (deltaRa / horizontalFovDeg) * width,
    y: height / 2 - ((decDeg - centerDecDeg) / verticalFovDeg) * height,
  };
}

export const cosmicCatalog: CosmicCatalogObject[] = [
  {
    slug: "andromeda-galaxy", nameZh: "仙女座星系", nameEn: "Andromeda Galaxy", type: "galaxy",
    raHours: 0.712, decDeg: 41.269, magnitude: 3.44, visualSize: 3.2, color: "#b8c9e8", aliases: ["M31", "NGC 224"],
  },
  {
    slug: "triangulum-galaxy", nameZh: "三角座星系", nameEn: "Triangulum Galaxy", type: "galaxy",
    raHours: 1.564, decDeg: 30.66, magnitude: 5.72, visualSize: 2.1, color: "#aabbd8", aliases: ["M33", "NGC 598"],
  },
  {
    slug: "whirlpool-galaxy", nameZh: "涡状星系", nameEn: "Whirlpool Galaxy", type: "galaxy",
    raHours: 13.497, decDeg: 47.195, magnitude: 8.4, visualSize: 1.35, color: "#b5c8df", aliases: ["M51", "NGC 5194"],
  },
  {
    slug: "sombrero-galaxy", nameZh: "草帽星系", nameEn: "Sombrero Galaxy", type: "galaxy",
    raHours: 12.667, decDeg: -11.623, magnitude: 8.0, visualSize: 1.3, color: "#d7c3aa", aliases: ["M104", "NGC 4594"],
  },
  {
    slug: "centaurus-a", nameZh: "半人马座A", nameEn: "Centaurus A", type: "galaxy",
    raHours: 13.425, decDeg: -43.019, magnitude: 6.84, visualSize: 1.55, color: "#c6ae97", aliases: ["NGC 5128"],
  },
  {
    slug: "large-magellanic-cloud", nameZh: "大麦哲伦云", nameEn: "Large Magellanic Cloud", type: "galaxy",
    raHours: 5.392, decDeg: -69.756, magnitude: 0.9, visualSize: 3.6, color: "#b7c8d9", aliases: ["LMC"],
  },
  {
    slug: "small-magellanic-cloud", nameZh: "小麦哲伦云", nameEn: "Small Magellanic Cloud", type: "galaxy",
    raHours: 0.877, decDeg: -72.8, magnitude: 2.7, visualSize: 2.8, color: "#b7c8d9", aliases: ["SMC", "NGC 292"],
  },
  {
    slug: "orion-nebula", nameZh: "猎户座大星云", nameEn: "Orion Nebula", type: "nebula",
    raHours: 5.588, decDeg: -5.391, magnitude: 4.0, visualSize: 2.3, color: "#8fc7b5", aliases: ["M42", "NGC 1976"],
  },
  {
    slug: "lagoon-nebula", nameZh: "礁湖星云", nameEn: "Lagoon Nebula", type: "nebula",
    raHours: 18.061, decDeg: -24.386, magnitude: 6.0, visualSize: 2.05, color: "#d09bb3", aliases: ["M8", "NGC 6523"],
  },
  {
    slug: "crab-nebula", nameZh: "蟹状星云", nameEn: "Crab Nebula", type: "nebula",
    raHours: 5.576, decDeg: 22.015, magnitude: 8.4, visualSize: 1.25, color: "#d0a38e", aliases: ["M1", "NGC 1952"],
  },
  {
    slug: "ring-nebula", nameZh: "环状星云", nameEn: "Ring Nebula", type: "nebula",
    raHours: 18.893, decDeg: 33.03, magnitude: 8.8, visualSize: 1.0, color: "#75b9aa", aliases: ["M57", "NGC 6720"],
  },
  {
    slug: "dumbbell-nebula", nameZh: "哑铃星云", nameEn: "Dumbbell Nebula", type: "nebula",
    raHours: 19.993, decDeg: 22.721, magnitude: 7.5, visualSize: 1.25, color: "#83b7a9", aliases: ["M27", "NGC 6853"],
  },
  {
    slug: "pleiades", nameZh: "昴星团", nameEn: "Pleiades", type: "open_cluster",
    raHours: 3.79, decDeg: 24.117, magnitude: 1.6, visualSize: 2.35, color: "#b9d5ff", aliases: ["M45", "七姐妹星团"],
  },
  {
    slug: "hyades", nameZh: "毕星团", nameEn: "Hyades", type: "open_cluster",
    raHours: 4.45, decDeg: 15.87, magnitude: 0.5, visualSize: 2.8, color: "#d2d8e5", aliases: ["Melotte 25"],
  },
  {
    slug: "beehive-cluster", nameZh: "蜂巢星团", nameEn: "Beehive Cluster", type: "open_cluster",
    raHours: 8.667, decDeg: 19.667, magnitude: 3.7, visualSize: 2.0, color: "#c7d8f1", aliases: ["M44", "鬼星团"],
  },
  {
    slug: "double-cluster", nameZh: "双星团", nameEn: "Double Cluster", type: "open_cluster",
    raHours: 2.333, decDeg: 57.15, magnitude: 3.7, visualSize: 2.0, color: "#c9d9f2", aliases: ["NGC 869", "NGC 884"],
  },
  {
    slug: "hercules-globular-cluster", nameZh: "武仙座球状星团", nameEn: "Hercules Globular Cluster", type: "globular_cluster",
    raHours: 16.695, decDeg: 36.467, magnitude: 5.8, visualSize: 1.55, color: "#d8c7aa", aliases: ["M13", "NGC 6205"],
  },
  {
    slug: "omega-centauri", nameZh: "半人马座欧米伽星团", nameEn: "Omega Centauri", type: "globular_cluster",
    raHours: 13.447, decDeg: -47.479, magnitude: 3.9, visualSize: 1.8, color: "#d7c5a6", aliases: ["NGC 5139"],
  },
];
