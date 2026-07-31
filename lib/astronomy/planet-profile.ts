import type { StellarProfile } from "@/lib/astronomy/stellar-profile";

interface PlanetReference {
  magnitude: number | null;
  colorLabel: string;
  colorHex: string;
  colorDescription: string;
  visibility: string;
}

const planetReferences: Record<string, PlanetReference> = {
  sun: {
    magnitude: -26.74,
    colorLabel: "黄白色",
    colorHex: "#fff2b8",
    colorDescription: "太阳光的常见观感",
    visibility: "太阳不能直接用肉眼或手机相机观测，观测它必须使用合适的太阳滤镜。",
  },
  moon: {
    magnitude: -12.74,
    colorLabel: "灰白色",
    colorHex: "#e8e7dc",
    colorDescription: "月面反射阳光的常见观感",
    visibility: "月球亮度会随月相、地月距离和地球大气条件变化。",
  },
  mercury: {
    magnitude: -1.9,
    colorLabel: "灰黄色",
    colorHex: "#d8c8a9",
    colorDescription: "岩石表面反射阳光的常见观感",
    visibility: "水星通常靠近太阳方向出现，观测窗口短，地平线附近的透明度很重要。",
  },
  venus: {
    magnitude: -4.7,
    colorLabel: "淡黄色",
    colorHex: "#fff0c2",
    colorDescription: "云层反射阳光的常见观感",
    visibility: "金星是夜空中最容易辨认的行星之一，通常出现在日落后的西方或日出前的东方。",
  },
  mars: {
    magnitude: -2.9,
    colorLabel: "橙红色",
    colorHex: "#e88a62",
    colorDescription: "表面尘埃和氧化铁带来的常见观感",
    visibility: "火星的亮度会随地火距离明显变化，橙红色通常比亮度更容易帮助辨认。",
  },
  jupiter: {
    magnitude: -2.9,
    colorLabel: "奶白色",
    colorHex: "#f1dfbf",
    colorDescription: "云带反射阳光的常见观感",
    visibility: "木星通常很亮，晴朗夜晚肉眼容易看见，双筒望远镜还可能看到它的卫星。",
  },
  saturn: {
    magnitude: 0.46,
    colorLabel: "淡黄色",
    colorHex: "#ead8a4",
    colorDescription: "高层云层反射阳光的常见观感",
    visibility: "土星通常呈稳定的淡黄色光点，望远镜才能确认它的光环。",
  },
  uranus: {
    magnitude: 5.68,
    colorLabel: "蓝绿色",
    colorHex: "#a9d9d4",
    colorDescription: "大气层颜色的常见观感",
    visibility: "天王星接近肉眼极限，通常需要双筒望远镜或望远镜确认。",
  },
  neptune: {
    magnitude: 7.78,
    colorLabel: "深蓝色",
    colorHex: "#769bd8",
    colorDescription: "大气层颜色的常见观感",
    visibility: "海王星不能靠肉眼确认，通常需要望远镜和星图定位。",
  },
  earth: {
    magnitude: null,
    colorLabel: "蓝白色",
    colorHex: "#a9d8ed",
    colorDescription: "从太空观察地球时的常见观感",
    visibility: "地球不是从地面向天空观测的目标，这里只展示它从太空中的颜色特征。",
  },
};

function planetBrightnessLabel(magnitude: number | null): string {
  if (magnitude == null) return "不适用于地面观测";
  if (magnitude < -4) return "极亮天体";
  if (magnitude < -1) return "非常明亮";
  if (magnitude < 1) return "明亮天体";
  if (magnitude < 6) return "较暗天体";
  return "望远镜目标";
}

export function getPlanetProfile(slug: string, databaseMagnitude?: number | null): StellarProfile | null {
  const reference = planetReferences[slug];
  if (!reference) return null;

  const magnitude = databaseMagnitude ?? reference.magnitude;
  return {
    categoryLabel: slug === "moon" ? "天然卫星" : "行星",
    magnitude,
    magnitudeLabel: slug === "moon" ? "平均视星等" : "典型视星等",
    brightnessLabel: planetBrightnessLabel(magnitude),
    brightnessDefinition: magnitude == null
      ? "当前对象不适合用地面视星等表示"
      : `参考值约为 ${magnitude.toFixed(2)} 等，实际值会随距离、相位和观测时间变化`,
    brightnessGuide: reference.visibility,
    nakedEyeVisibility: reference.visibility,
    visualColorLabel: reference.colorLabel,
    visualColorHex: reference.colorHex,
    visualColorDescription: reference.colorDescription,
  };
}
