import type { BrightStar } from "@/lib/astronomy/bright-stars";

export interface StellarProfile {
  categoryLabel: string;
  magnitude: number | null;
  magnitudeLabel: string;
  brightnessLabel: string;
  brightnessDefinition: string;
  brightnessGuide: string;
  nakedEyeVisibility: string;
  visualColorLabel: string;
  visualColorHex: string;
  visualColorDescription: string;
}

interface VisualColor {
  label: string;
  hex: string;
  description: string;
}

const visualColorBySlug: Record<string, VisualColor> = {
  sirius: { label: "白色偏蓝", hex: "#dbe7ff", description: "高温恒星的白蓝色观感" },
  canopus: { label: "黄白色", hex: "#fff1c7", description: "偏暖的白色观感" },
  arcturus: { label: "橙黄色", hex: "#ffc27d", description: "低温巨星常见的暖色观感" },
  vega: { label: "蓝白色", hex: "#cbdcff", description: "高温恒星常见的蓝白色观感" },
  capella: { label: "黄白色", hex: "#fff0c3", description: "双星系统整体呈暖白色" },
  rigel: { label: "蓝白色", hex: "#bdd2ff", description: "高温蓝超巨星的蓝白色观感" },
  procyon: { label: "黄白色", hex: "#fff1d0", description: "偏暖的白色观感" },
  betelgeuse: { label: "橙红色", hex: "#ff9a62", description: "低温红超巨星明显的暖色观感" },
  altair: { label: "白色偏蓝", hex: "#d9e4ff", description: "高温恒星的白蓝色观感" },
  aldebaran: { label: "橙色", hex: "#ffad68", description: "橙色巨星的暖色观感" },
  antares: { label: "橙红色", hex: "#ff8b5b", description: "红超巨星明显的暖色观感" },
  spica: { label: "蓝白色", hex: "#bed3ff", description: "高温双星系统的蓝白色观感" },
  polaris: { label: "黄白色", hex: "#fff0cc", description: "主星整体呈偏暖的白色观感" },
  regulus: { label: "蓝白色", hex: "#c5d8ff", description: "高温恒星的蓝白色观感" },
  deneb: { label: "蓝白色", hex: "#c6d9ff", description: "蓝白超巨星的观感" },
  achernar: { label: "蓝白色", hex: "#c5d8ff", description: "高温恒星的蓝白色观感" },
  agena: { label: "蓝白色", hex: "#bdd2ff", description: "高温恒星的蓝白色观感" },
  pollux: { label: "橙黄色", hex: "#ffc879", description: "低温巨星的暖色观感" },
  fomalhaut: { label: "白色", hex: "#eef3ff", description: "肉眼通常呈白色" },
  castor: { label: "白色偏蓝", hex: "#dce7ff", description: "多星系统整体呈白蓝色" },
  alioth: { label: "白色", hex: "#edf3ff", description: "肉眼通常呈白色" },
  dubhe: { label: "黄白色", hex: "#ffe5ae", description: "偏暖的白黄色观感" },
  alkaid: { label: "蓝白色", hex: "#c5d8ff", description: "高温恒星的蓝白色观感" },
  hamal: { label: "橙色", hex: "#ffb36e", description: "橙色巨星的暖色观感" },
  mirach: { label: "橙红色", hex: "#ff9b65", description: "红巨星的暖色观感" },
  alpheratz: { label: "蓝白色", hex: "#c8d9ff", description: "高温恒星的蓝白色观感" },
  mizar: { label: "白色", hex: "#edf3ff", description: "肉眼通常呈白色" },
  merak: { label: "白色", hex: "#edf3ff", description: "肉眼通常呈白色" },
  phecda: { label: "白色", hex: "#edf3ff", description: "肉眼通常呈白色" },
  megrez: { label: "白色", hex: "#edf3ff", description: "肉眼通常呈白色" },
};

const defaultVisualColor: VisualColor = {
  label: "白色",
  hex: "#edf3ff",
  description: "肉眼通常接近白色，颜色不容易直接分辨",
};

function getBrightness(magnitude: number) {
  if (magnitude < 0) {
    return {
      label: "极亮恒星（负星等）",
      definition: "视星等小于 0，亮度明显高于一等星",
      guide: "这是肉眼天空中最醒目的恒星等级，晴朗夜晚通常很容易从背景星点中分辨出来。",
      visibility: "在晴朗夜晚通常很容易用肉眼找到，即使在有一定光污染的城市也常能分辨。",
    };
  }
  if (magnitude < 1) {
    return {
      label: "一等亮星",
      definition: "视星等为 0 至小于 1",
      guide: "“一等”是亮度分档，不是第一颗星；晴朗夜晚肉眼容易看见，织女星就是这一档。",
      visibility: "在晴朗夜晚通常很容易用肉眼看到；织女星属于这一档。",
    };
  }
  if (magnitude < 2) {
    return {
      label: "二等星",
      definition: "视星等为 1 至小于 2",
      guide: "肉眼仍然比较容易看到，但比一等亮星低一档，更容易受到光污染和薄云影响。",
      visibility: "在晴朗夜晚通常可以用肉眼看到，但光污染、薄云和目标高度会明显影响观感。",
    };
  }
  if (magnitude < 3.5) {
    return {
      label: "三等星",
      definition: "视星等为 2 至小于 3.5",
      guide: "属于普通肉眼可见的较暗恒星，离开强光环境后会更容易确认。",
      visibility: "肉眼可以看到，但更依赖较暗的天空、透明度和几分钟的暗适应。",
    };
  }
  return {
    label: "较暗恒星",
    definition: "视星等为 3.5 或更暗",
    guide: "这类恒星在城市里可能不明显，通常需要较暗的天空和更充分的暗适应。",
    visibility: "在城市环境中可能不明显，建议前往更暗的地点并结合星图确认。",
  };
}

export function getStellarProfile(star: Pick<BrightStar, "slug" | "magnitude">): StellarProfile {
  const brightness = getBrightness(star.magnitude);
  const color = visualColorBySlug[star.slug] ?? defaultVisualColor;

  return {
    categoryLabel: "恒星",
    magnitude: star.magnitude,
    magnitudeLabel: "视星等",
    brightnessLabel: brightness.label,
    brightnessDefinition: brightness.definition,
    brightnessGuide: brightness.guide,
    nakedEyeVisibility: brightness.visibility,
    visualColorLabel: color.label,
    visualColorHex: color.hex,
    visualColorDescription: color.description,
  };
}
