"use client";

/**
 * 自控可见星空层 — V2 主交互面
 *
 * 职责：渲染可见星空背景 + MVP 天体星点 + 标签 + 点击识别
 *
 * StarCanvas 当前作为星图页的主交互面，所有鼠标事件由本层处理。
 * WWT 引擎保留在底层，仅作为时间/地点/坐标系统能力保留，
 * 当前不接收鼠标事件（被 StarCanvas 覆盖）。
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { Horizon, MakeTime, Observer, Body, Equator } from "astronomy-engine";
import { activeBrightStars } from "@/lib/astronomy/bright-stars";

interface CelestialClick {
  name: string;
  type: string;
  slug: string;
}

interface StarCanvasProps {
  onObjectClick: (obj: CelestialClick) => void;
  target: string | null;
  source?: "primary" | "secondary" | "related" | "search";
  selected: { slug: string } | null;
  obsTime: Date;
  obsLocation: { lat: number; lng: number };
  /** 朝向模式：设备方位角(0-360°, 0=北) + 仰角(0-90°, 90=天顶) */
  orientation?: { azimuth: number; pitch: number };
}

/** URL slug → StarCanvas 星点名称的映射 */
const slugToStarName: Record<string, string> = {
  jupiter: "木星",
  venus: "金星",
  mars: "火星",
  saturn: "土星",
  moon: "月球",
  vega: "织女星",
  orion: "猎户座",
  // 通用回退 targetRef → 映射到最显眼的具体对象
  "brightest-visible-target": "木星",
  "bright-star-entry": "天狼星",
};

interface StarDot {
  name: string;
  x: number;
  y: number;
  r: number;
  color: string;
  label?: string;
}

/** 可点击对象的 type/slug 映射 — 仅包含 celestial_objects 中已入库的对象 */
const objectMeta: Record<string, { type: string; slug: string }> = {
  "木星": { type: "planet", slug: "jupiter" },
  "金星": { type: "planet", slug: "venus" },
  "火星": { type: "planet", slug: "mars" },
  "土星": { type: "planet", slug: "saturn" },
  "月球": { type: "planet", slug: "moon" },
  "织女星": { type: "bright_star", slug: "vega" },
  "天狼星": { type: "bright_star", slug: "sirius" },
  "北极星": { type: "bright_star", slug: "polaris" },
  "参宿四": { type: "bright_star", slug: "betelgeuse" },
  "猎户座": { type: "constellation", slug: "orion" },
};

const clickableStars = new Set(Object.keys(objectMeta));

const stars: StarDot[] = [
  { name: "参宿一", x: 0.50, y: 0.45, r: 0.8, color: "#c8d8ff", label: "猎户座腰带" },
  { name: "参宿二", x: 0.52, y: 0.44, r: 0.8, color: "#c8d8ff" },
  { name: "参宿三", x: 0.48, y: 0.43, r: 0.8, color: "#c8d8ff" },
  { name: "参宿四", x: 0.45, y: 0.38, r: 1.6, color: "#f0a050", label: "参宿四" },
  { name: "参宿七", x: 0.55, y: 0.52, r: 1.2, color: "#b0d0ff", label: "参宿七" },
  { name: "参宿五", x: 0.42, y: 0.47, r: 0.6, color: "#c8d8ff" },
  { name: "参宿六", x: 0.57, y: 0.40, r: 0.6, color: "#c8d8ff" },
  { name: "木星", x: 0.70, y: 0.25, r: 2.0, color: "#ffe0b0", label: "木星" },
  { name: "金星", x: 0.78, y: 0.18, r: 1.6, color: "#ffffe0", label: "金星" },
  { name: "火星", x: 0.72, y: 0.48, r: 1.2, color: "#f0a080", label: "火星" },
  { name: "土星", x: 0.58, y: 0.68, r: 1.4, color: "#f0e0c0", label: "土星" },
  { name: "织女星", x: 0.30, y: 0.20, r: 1.8, color: "#e0e8ff", label: "织女星" },
  { name: "月球", x: 0.65, y: 0.55, r: 2.5, color: "#ffffe8", label: "月球" },
  { name: "天狼星", x: 0.60, y: 0.60, r: 1.5, color: "#e0e8ff", label: "天狼星" },
  { name: "北极星", x: 0.50, y: 0.08, r: 1.0, color: "#e8e0d0", label: "北极星" },
  { name: "猎户座", x: 0.50, y: 0.45, r: 3.0, color: "transparent", label: "猎户座" },
  ...[...Array(40)].map(() => ({
    name: "bg",
    x: 0.05 + Math.random() * 0.9,
    y: 0.05 + Math.random() * 0.9,
    r: 0.10 + Math.random() * 0.35,
    color: Math.random() < 0.10 ? "#f0d8b0" : Math.random() < 0.25 ? "#b0c0e8" : "#b8c0d0",
  })),
];

export default function StarCanvas({
  onObjectClick,
  target,
  source = "primary",
  selected,
  obsTime,
  obsLocation,
  orientation,
}: StarCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dimsRef = useRef({
    W: 0, H: 0,
    animStart: 0, animSlug: "",
    /** 实时渲染位置 — 供点击命中检测使用 */
    nameToPos: new Map<string, { x: number; y: number }>(),
  });
  const [, forceRender] = useState(0);

  // selected 变化时触发短暂扩散动画
  const prevSlugRef = useRef<string | null>(null);
  useEffect(() => {
    if (selected?.slug && selected.slug !== prevSlugRef.current) {
      prevSlugRef.current = selected.slug;
      dimsRef.current.animStart = performance.now();
      dimsRef.current.animSlug = selected.slug;

      // requestAnimationFrame 循环驱动动画期间的画布重绘
      const start = dimsRef.current.animStart;
      function tick() {
        const elapsed = performance.now() - start;
        forceRender((n) => n + 1);
        if (elapsed < 550) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
    if (!selected?.slug) {
      prevSlugRef.current = null;
    }
  }, [selected?.slug]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    dimsRef.current.W = W;
    dimsRef.current.H = H;

    // ---- 根据 obsTime 计算 MVP 对象的实时 canvas 位置 ----
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(W, H) / 2 * 0.85;

    // 内容池对象坐标（RA hours, Dec degrees），对应 objectMeta 中的可点击对象
    const coordLookup: Record<string, { raH: number; decD: number; isPlanet: boolean; body?: Body }> = {
      "木星": { raH: 0, decD: 0, isPlanet: true, body: Body.Jupiter },
      "金星": { raH: 0, decD: 0, isPlanet: true, body: Body.Venus },
      "火星": { raH: 0, decD: 0, isPlanet: true, body: Body.Mars },
      "土星": { raH: 0, decD: 0, isPlanet: true, body: Body.Saturn },
      "月球": { raH: 0, decD: 0, isPlanet: true, body: Body.Moon },
      "织女星": { raH: 18.6156, decD: 38.7837, isPlanet: false },
      "天狼星": { raH: 6.7525, decD: -16.7161, isPlanet: false },
      "参宿四": { raH: 5.9195, decD: 7.4071, isPlanet: false },
      "北极星": { raH: 2.5303, decD: 89.2641, isPlanet: false },
      "猎户座": { raH: 5.5, decD: 5.0, isPlanet: false },
    };

    // 扩展亮星层 — 不在核心对象池中，视觉更轻，不点击
    const coreSlugs = new Set(Object.values(objectMeta).map((m) => m.slug));
    const extendedStars = activeBrightStars()
      .filter((s) => !coreSlugs.has(s.slug))
      .map((s) => ({ name: s.nameZh, raH: s.raHours, decD: s.decDeg, mag: s.magnitude }));

    const nameToPos = new Map<string, { x: number; y: number }>();
    try {
      const t = MakeTime(obsTime);
      const obs = new Observer(obsLocation.lat, obsLocation.lng, 0);

      const orient = orientation;
      const fovDeg = 90;
      const viewAzRad = orient ? (orient.azimuth * Math.PI) / 180 : 0;
      const viewAlt = orient ? orient.pitch : 90;
      const cosViewAlt = Math.cos(viewAlt * Math.PI / 180);

      for (const [name, c] of Object.entries(coordLookup)) {
        let alt: number, az: number;
        if (c.isPlanet && c.body) {
          const eq = Equator(c.body, t, obs, true, true);
          const hor = Horizon(t, obs, eq.ra, eq.dec);
          alt = hor.altitude; az = hor.azimuth;
        } else {
          const hor = Horizon(t, obs, c.raH * 15, c.decD);
          alt = hor.altitude; az = hor.azimuth;
        }

        let px: number, py: number;

        if (orient) {
          // 朝向投影：以设备朝向为中心，FOV=90° 的 rectilinear 映射
          const dAz = ((az - orient.azimuth + 540) % 360) - 180;
          const dAlt = alt - orient.pitch;
          const hFov = fovDeg / 2;
          const xFactor = Math.abs(dAz * cosViewAlt) > hFov ? (dAz > 0 ? hFov : -hFov) / (dAz * cosViewAlt) : 1;
          const yFactor = Math.abs(dAlt) > hFov ? (dAlt > 0 ? hFov : -hFov) / dAlt : 1;
          const factor = Math.min(xFactor, yFactor);
          px = cx + (dAz * cosViewAlt * factor * W) / fovDeg;
          py = cy - (dAlt * factor * H) / fovDeg;
        } else {
          // 天顶投影：zenith 为画布中心
          const azRad = (az * Math.PI) / 180;
          const dist = alt > 0 ? (1 - alt / 90) * radius : radius * 1.05;
          px = cx + Math.sin(azRad) * dist;
          py = cy - Math.cos(azRad) * dist;
        }

        nameToPos.set(name, { x: px, y: py });
      }
    // 扩展亮星位置计算
    for (const s of extendedStars) {
      const hor = Horizon(t, obs, s.raH * 15, s.decD);
      const alt = hor.altitude; const az = hor.azimuth;

      let px: number, py: number;
      if (orient) {
        const dAz = ((az - orient.azimuth + 540) % 360) - 180;
        const dAlt = alt - orient.pitch;
        const hFov = fovDeg / 2;
        const dAzAdj = dAz * cosViewAlt;
        const xFactor = Math.abs(dAzAdj) > hFov ? (dAz > 0 ? hFov : -hFov) / dAzAdj : 1;
        const yFactor = Math.abs(dAlt) > hFov ? (dAlt > 0 ? hFov : -hFov) / dAlt : 1;
        const factor = Math.min(xFactor, yFactor);
        px = cx + (dAzAdj * factor * W) / fovDeg;
        py = cy - (dAlt * factor * H) / fovDeg;
      } else {
        const azRad = (az * Math.PI) / 180;
        const dist = alt > 0 ? (1 - alt / 90) * radius : radius * 1.05;
        px = cx + Math.sin(azRad) * dist;
        py = cy - Math.cos(azRad) * dist;
      }

      nameToPos.set(s.name, { x: px, y: py });
    }

    } catch { /* fallback to hardcoded positions */ }

    // 搜索命中后的轻聚焦 — 仅 source=search
    // 将目标向中心拉近 40%，所有对象跟随偏移
    if (source === "search" && target) {
      const targetName = slugToStarName[target];
      const tPos = targetName ? nameToPos.get(targetName) : null;
      if (tPos) {
        const shiftX = (cx - tPos.x) * 0.4;
        const shiftY = (cy - tPos.y) * 0.4;
        for (const [name, pos] of nameToPos) {
          nameToPos.set(name, { x: pos.x + shiftX, y: pos.y + shiftY });
        }
      }
    }

    dimsRef.current.nameToPos = nameToPos;

    // 夜空渐变背景
    const bg = ctx.createRadialGradient(W * 0.5, H * 0.15, 0, W * 0.5, H * 0.5, W * 0.8);
    bg.addColorStop(0, "#0a1628");
    bg.addColorStop(0.5, "#060e1c");
    bg.addColorStop(1, "#030810");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 微弱银河光带
    ctx.save();
    ctx.globalAlpha = 0.03;
    const mw = ctx.createLinearGradient(W * 0.2, H * 0.3, W * 0.7, H * 0.7);
    mw.addColorStop(0, "transparent");
    mw.addColorStop(0.4, "#8090c0");
    mw.addColorStop(0.6, "#8090c0");
    mw.addColorStop(1, "transparent");
    ctx.fillStyle = mw;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    for (const s of stars) {
      if (s.color === "transparent") continue; // 仅作为点击区域，不绘制星点

      const pos = nameToPos.get(s.name);
      const cx = pos ? pos.x : s.x * W;
      const cy = pos ? pos.y : s.y * H;

      if (s.r > 0.8) {
        ctx.save();
        ctx.globalAlpha = 0.12;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s.r * 5);
        g.addColorStop(0, s.color);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, s.r * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = s.name === "bg" ? 0.10 + Math.random() * 0.30 : 1;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s.r * 1.2);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.3, s.color);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, s.r * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // slug → star name 反向查找（selected 使用）
    const findStarBySlug = (slug: string) =>
      stars.find((s) => objectMeta[s.name]?.slug === slug) ?? null;

    const selectedStar = selected ? findStarBySlug(selected.slug) : null;
    const targetName = target ? slugToStarName[target] : null;
    const targetStar = targetName ? stars.find((s) => s.name === targetName) : null;
    const selectedIsTarget =
      selectedStar && targetStar && selectedStar.name === targetStar.name;

    // 扩展亮星 — 视觉介于核心对象与背景星点之间
    const labeledExtStars = new Set([
      "牛郎星", "天津四", "大角星", "五车二", "南河三", "心宿二", "老人星",
    ]);

    for (const s of extendedStars) {
      const pos = nameToPos.get(s.name);
      if (!pos) continue;
      const cx = pos.x; const cy = pos.y;
      // 半径：亮星（低星等）更大，范围 0.4–1.2
      const r = Math.max(0.4, (1.5 - s.mag * 0.25));

      // 星点本体
      ctx.save();
      ctx.globalAlpha = 0.55;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.3);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.4, "#b0c8e8");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 轻标签 — 仅高识别度亮星
      if (labeledExtStars.has(s.name)) {
        ctx.save();
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillText(s.name, cx, cy + r + 10);
        ctx.restore();
      }
    }

    // 目标引导高亮 — 仅在无 selected 或 selected 不等于 target 时显示
    // selected 等于 target 时降权为极轻，selected 不等于 target 时完全消失
    if (target && targetStar && !selectedIsTarget) {
      const tPos = nameToPos.get(targetStar.name);
      const tx = tPos ? tPos.x : targetStar.x * W;
      const ty = tPos ? tPos.y : targetStar.y * H;
      const isSearch = source === "search";
      const isPrimary = source === "primary";
      const isRelated = source === "related";
      const isSecondary = source === "secondary";
      const hasSelected = selectedStar != null;
      // ring radius: search > primary > related > secondary
      const scale = isSearch ? 5 : isPrimary ? 4 : isRelated ? 3.5 : 3;
      const minR = isSearch ? 30 : isPrimary ? 24 : isRelated ? 20 : 16;
      const tr = Math.max(targetStar.r * scale, minR);
      const ringAlpha = hasSelected ? 0.03 : isSearch ? 0.18 : isPrimary ? 0.12 : isRelated ? 0.09 : 0.06;
      const glowAlpha = hasSelected ? 0.04 : isSearch ? 0.22 : isPrimary ? 0.15 : isRelated ? 0.12 : 0.08;

      // 外圈
      ctx.save();
      ctx.globalAlpha = ringAlpha;
      const ring = ctx.createRadialGradient(tx, ty, tr * 0.5, tx, ty, tr);
      ring.addColorStop(0, "transparent");
      ring.addColorStop(0.6, "#f0a54a");
      ring.addColorStop(1, "transparent");
      ctx.fillStyle = ring;
      ctx.beginPath();
      ctx.arc(tx, ty, tr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 内圈
      ctx.save();
      ctx.globalAlpha = glowAlpha;
      const inner = ctx.createRadialGradient(tx, ty, tr * 0.2, tx, ty, tr * 0.6);
      inner.addColorStop(0, "#f0a54a");
      inner.addColorStop(1, "transparent");
      ctx.fillStyle = inner;
      ctx.beginPath();
      ctx.arc(tx, ty, tr * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // "先看这里" — 仅 primary 且无 selected 时显示
      if (isPrimary && !hasSelected) {
        ctx.save();
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(240,165,74,0.45)";
        ctx.fillText("先看这里", tx, ty - tr * 1.1);
        ctx.restore();
      }
    }

    // selectedObject 选中态 — 最高视觉优先级，独立样式
    if (selectedStar) {
      const sPos = nameToPos.get(selectedStar.name);
      const sx = sPos ? sPos.x : selectedStar.x * W;
      const sy = sPos ? sPos.y : selectedStar.y * H;
      const sr = Math.max(selectedStar.r * 4.5, 28);

      // 选中外圈：蓝白冷色环
      ctx.save();
      ctx.globalAlpha = 0.18;
      const sRing = ctx.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr);
      sRing.addColorStop(0, "transparent");
      sRing.addColorStop(0.5, "#80b8ff");
      sRing.addColorStop(1, "transparent");
      ctx.fillStyle = sRing;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 选中内圈：蓝白辉光
      ctx.save();
      ctx.globalAlpha = 0.12;
      const sInner = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 0.5);
      sInner.addColorStop(0, "#c0dfff");
      sInner.addColorStop(1, "transparent");
      ctx.fillStyle = sInner;
      ctx.beginPath();
      ctx.arc(sx, sy, sr * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 选中变化时的短暂扩散动画效果 — 外圈先扩后收
    const animTime = dimsRef.current;
    const now = performance.now();
    const animAge = now - animTime.animStart;
    if (animTime.animSlug && animAge < 500) {
      const animStar = stars.find((s) => objectMeta[s.name]?.slug === animTime.animSlug);
      if (animStar) {
        const t = animAge / 500; // 0→1
        const ease = 1 - Math.pow(1 - t, 3); // ease-out
        const aPos = nameToPos.get(animStar.name);
        const ax = aPos ? aPos.x : animStar.x * W;
        const ay = aPos ? aPos.y : animStar.y * H;
        const ar = Math.max(animStar.r * 3, 20) * (1 + ease * 0.8);

        ctx.save();
        ctx.globalAlpha = 0.25 * (1 - ease);
        const aRing = ctx.createRadialGradient(ax, ay, ar * 0.7, ax, ay, ar);
        aRing.addColorStop(0, "transparent");
        aRing.addColorStop(0.6, "#80b8ff");
        aRing.addColorStop(1, "transparent");
        ctx.fillStyle = aRing;
        ctx.beginPath();
        ctx.arc(ax, ay, ar, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 星座连线 — 低权重，辅助形状记忆
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.strokeStyle = "#8090b0";
    ctx.lineWidth = 0.5;
    const orionStars = stars.filter((s) =>
      ["参宿一", "参宿二", "参宿三", "参宿四", "参宿五", "参宿六", "参宿七"].includes(s.name),
    );
    drawLine(ctx, orionStars, "参宿一", "参宿二", W, H, nameToPos);
    drawLine(ctx, orionStars, "参宿二", "参宿三", W, H, nameToPos);
    drawLine(ctx, orionStars, "参宿四", "参宿一", W, H, nameToPos);
    drawLine(ctx, orionStars, "参宿七", "参宿三", W, H, nameToPos);
    drawLine(ctx, orionStars, "参宿五", "参宿一", W, H, nameToPos);
    drawLine(ctx, orionStars, "参宿六", "参宿三", W, H, nameToPos);
    ctx.restore();

    ctx.save();
    ctx.textAlign = "center";
    for (const s of stars) {
      if (!s.label) continue;
      const pos = nameToPos.get(s.name);
      const cx = pos ? pos.x : s.x * W;
      const cy = pos ? pos.y : s.y * H;
      const isMain = clickableStars.has(s.name);
      ctx.font = isMain ? "11px sans-serif" : "9px sans-serif";
      ctx.fillStyle = isMain ? "rgba(255,255,255,0.40)" : "rgba(255,255,255,0.18)";
      ctx.fillText(s.label, cx, cy + s.r + 12);
    }
    ctx.restore();

    ctx.save();
    ctx.font = "10px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.textAlign = "center";
    ctx.fillText("N", W * 0.5, 16);
    ctx.fillText("E", W - 16, H * 0.5);
    ctx.fillText("S", W * 0.5, H - 12);
    ctx.fillText("W", 16, H * 0.5);
    ctx.restore();
  }, [target, source, selected, obsTime, obsLocation]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = ref.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      const n2p = dimsRef.current.nameToPos;

      // 仅在可点击对象中查找命中
      for (const s of stars) {
        if (!clickableStars.has(s.name)) continue;

        // 使用实时渲染位置（与绘制坐标一致）
        const pos = n2p.get(s.name);
        const sx = pos ? pos.x / rect.width : s.x;
        const sy = pos ? pos.y / rect.height : s.y;

        const hitR = Math.max(s.r * 3, 20) / Math.max(rect.width, 1);
        const dx = sx - nx;
        const dy = sy - ny;
        if (Math.sqrt(dx * dx + dy * dy) < hitR) {
          const meta = objectMeta[s.name];
          onObjectClick({ name: s.name, type: meta.type, slug: meta.slug });
          return;
        }
      }
    },
    [onObjectClick],
  );

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 h-full w-full cursor-crosshair"
      style={{ background: "#030810" }}
      onClick={handleClick}
    />
  );
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  stars: StarDot[],
  a: string,
  b: string,
  W: number,
  H: number,
  nameToPos: Map<string, { x: number; y: number }>,
) {
  const sa = stars.find((s) => s.name === a);
  const sb = stars.find((s) => s.name === b);
  const pa = nameToPos.get(a);
  const pb = nameToPos.get(b);
  if (!sa || !sb) return;
  const ax = pa ? pa.x : sa.x * W;
  const ay = pa ? pa.y : sa.y * H;
  const bx = pb ? pb.x : sb.x * W;
  const by = pb ? pb.y : sb.y * H;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
}
