/**
 * 本地流星雨数据层 — 未来一年主要流星雨
 * 数据来源：IMO（International Meteor Organization）历年平均值
 * 日期适配 2026–2027 观测季
 */

export interface MeteorShower {
  slug: string;
  nameZh: string;
  nameEn: string;
  /** 活跃期起止，MM-DD 格式；跨年用两段 */
  activeStart: string;
  activeEnd: string;
  /** 峰值夜，ISO 日期 */
  peakDate: string;
  /** 峰值小时流星数（ZHR） */
  zhr: number;
  /** 推荐观测时段 */
  recommendedTime: string;
  /** 理想观测地类型 */
  locationHint: string;
}

export const meteorShowers: MeteorShower[] = [
  {
    slug: "perseids",
    nameZh: "英仙座流星雨",
    nameEn: "Perseids",
    activeStart: "07-17",
    activeEnd: "08-24",
    peakDate: "2026-08-13",
    zhr: 100,
    recommendedTime: "午夜后至凌晨",
    locationHint: "远离城市灯光的开阔地",
  },
  {
    slug: "draconids",
    nameZh: "天龙座流星雨",
    nameEn: "Draconids",
    activeStart: "10-06",
    activeEnd: "10-10",
    peakDate: "2026-10-08",
    zhr: 10,
    recommendedTime: "傍晚至午夜",
    locationHint: "北方天空方向开阔处",
  },
  {
    slug: "orionids",
    nameZh: "猎户座流星雨",
    nameEn: "Orionids",
    activeStart: "10-02",
    activeEnd: "11-07",
    peakDate: "2026-10-22",
    zhr: 20,
    recommendedTime: "午夜后至凌晨",
    locationHint: "东南方向视野开阔处",
  },
  {
    slug: "leonids",
    nameZh: "狮子座流星雨",
    nameEn: "Leonids",
    activeStart: "11-06",
    activeEnd: "11-30",
    peakDate: "2026-11-18",
    zhr: 15,
    recommendedTime: "午夜后至凌晨",
    locationHint: "东方天空方向开阔处",
  },
  {
    slug: "geminids",
    nameZh: "双子座流星雨",
    nameEn: "Geminids",
    activeStart: "12-04",
    activeEnd: "12-20",
    peakDate: "2026-12-14",
    zhr: 120,
    recommendedTime: "整夜可见，午夜后最佳",
    locationHint: "远离城市灯光的开阔地",
  },
  {
    slug: "quadrantids",
    nameZh: "象限仪座流星雨",
    nameEn: "Quadrantids",
    activeStart: "12-28",
    activeEnd: "01-12",
    peakDate: "2027-01-04",
    zhr: 120,
    recommendedTime: "午夜后至黎明前",
    locationHint: "北方天空方向开阔处",
  },
  {
    slug: "lyrids",
    nameZh: "天琴座流星雨",
    nameEn: "Lyrids",
    activeStart: "04-16",
    activeEnd: "04-25",
    peakDate: "2027-04-22",
    zhr: 18,
    recommendedTime: "午夜后至凌晨",
    locationHint: "东方天空方向开阔处",
  },
  {
    slug: "eta-aquariids",
    nameZh: "宝瓶座η流星雨",
    nameEn: "Eta Aquariids",
    activeStart: "04-19",
    activeEnd: "05-28",
    peakDate: "2027-05-06",
    zhr: 60,
    recommendedTime: "黎明前",
    locationHint: "东南方向视野开阔处",
  },
];

/** 返回峰值在指定日期之后的流星雨，按峰值日升序 */
export function upcomingShowers(after = new Date()): MeteorShower[] {
  const cutoff = after.toISOString().slice(0, 10);
  return meteorShowers
    .filter((s) => s.peakDate >= cutoff)
    .sort((a, b) => a.peakDate.localeCompare(b.peakDate));
}
