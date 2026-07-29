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
import { activeConstellations, getConstellation, getConstellationMembers } from "@/lib/astronomy/constellations";
import {
  cosmicCatalog,
  normalizeDegrees,
  projectEquatorialToPanorama,
  type CosmicCatalogObject,
} from "@/lib/astronomy/cosmic-map";
import { stellarEquatorOfDate } from "@/lib/astronomy/stellar-coordinates";

interface CelestialClick {
  name: string;
  type: string;
  slug: string;
  isPreviewOnly?: boolean;
}

interface StarCanvasProps {
  onObjectClick: (obj: CelestialClick) => void;
  onAimTargetChange?: (obj: CelestialClick | null, nearby: CelestialClick[]) => void;
  target: string | null;
  source?: "primary" | "secondary" | "related" | "search";
  selected: { slug: string; type?: string } | null;
  obsTime: Date;
  obsLocation: { lat: number; lng: number };
  /** 平面总览模式：按赤经/赤纬绘制可横向循环浏览的天球目录 */
  is2DMode?: boolean;
  /** 观察模式：设备方位角(0-360°) + 仰角(-45-90°) + 左右倾斜角(°) */
  orientation?: { azimuth: number; pitch: number; gamma: number };
  /** 猎户座相关目标接近最佳时段 */
  orionBestWindow?: boolean;
  /** AR 模式：保留星点/标签层，让摄像头画面作为背景 */
  arMode?: boolean;
}

const brightStarSlugToName = Object.fromEntries(
  activeBrightStars().map((s) => [s.slug, s.nameZh]),
);

const constellationCatalog = activeConstellations();
const CONSTELLATION_MEMBER_SLUGS = new Set(
  constellationCatalog.flatMap((constellation) => constellation.memberSlugs),
);

/** URL slug → StarCanvas 星点名称的映射 */
const slugToStarName: Record<string, string> = {
  ...brightStarSlugToName,
  jupiter: "木星",
  venus: "金星",
  mars: "火星",
  saturn: "土星",
  moon: "月球",
  sun: "太阳",
  vega: "织女星",
  orion: "猎户座",
  // 通用回退 targetRef → 映射到最显眼的具体对象
  "brightest-visible-target": "木星",
  "bright-star-entry": "天狼星",
};

slugToStarName.bootes = "\u5927\u89D2\u661F";

interface StarDot {
  name: string;
  x: number;
  y: number;
  r: number;
  color: string;
  label?: string;
}

interface HitObject {
  name: string;
  type: string;
  slug: string;
  x: number;
  y: number;
  r: number;
  isPreviewOnly?: boolean;
}

function closestHitObject(hits: HitObject[], x: number, y: number): HitObject | null {
  let closest: HitObject | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const hit of hits) {
    const distance = Math.hypot(hit.x - x, hit.y - y);
    if (distance <= hit.r && distance < closestDistance) {
      closest = hit;
      closestDistance = distance;
    }
  }

  return closest;
}

const brightStarObjectMeta = Object.fromEntries(
  activeBrightStars().map((s) => [s.nameZh, { type: "bright_star", slug: s.slug }]),
);

/** 可点击对象的 type/slug 映射 */
const objectMeta: Record<string, { type: string; slug: string }> = {
  "水星": { type: "planet", slug: "mercury" },
  "木星": { type: "planet", slug: "jupiter" },
  "金星": { type: "planet", slug: "venus" },
  "火星": { type: "planet", slug: "mars" },
  "土星": { type: "planet", slug: "saturn" },
  "天王星": { type: "planet", slug: "uranus" },
  "海王星": { type: "planet", slug: "neptune" },
  "月球": { type: "planet", slug: "moon" },
  "太阳": { type: "star", slug: "sun" },
  ...brightStarObjectMeta,
  "猎户座": { type: "constellation", slug: "orion" },
};

for (const constellation of constellationCatalog) {
  objectMeta[constellation.nameZh] = { type: "constellation", slug: constellation.slug };
}
const clickableStars = new Set(Object.keys(objectMeta));
const NAMED_STAR_EDGE_ALPHA = 0.045;
const NAMED_STAR_LABEL_ALPHA = 0.055;
const OBS_VIEW_HALF_AZ_DEG = 86;
const OBS_CULL_HALF_AZ_DEG = 89.5;

function brightStarRadius(magnitude: number): number {
  return Math.max(1.05, Math.min(3.2, 2.65 - magnitude * 0.34));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function altitudeVisibility(alt: number): number {
  return 0.70 + 0.40 * clamp01((alt - 5) / 60);
}

function signedAzDelta(az: number, viewAz: number): number {
  return ((az - viewAz + 540) % 360) - 180;
}

function observationHorizontalGate(signedDAz: number): number {
  const absAz = Math.abs(signedDAz);
  if (absAz <= OBS_VIEW_HALF_AZ_DEG) return 1;
  return clamp01((OBS_CULL_HALF_AZ_DEG - absAz) / (OBS_CULL_HALF_AZ_DEG - OBS_VIEW_HALF_AZ_DEG));
}

function orientationViewAz(orientation?: { azimuth: number; pitch: number; gamma: number }, manualAz = 0): number {
  if (!orientation) return ((manualAz % 360) + 360) % 360;
  return (orientation.azimuth + manualAz + 360) % 360;
}

const panoramaBodies: Array<{ name: string; slug: string; type: string; body: Body; color: string }> = [
  { name: "太阳", slug: "sun", type: "star", body: Body.Sun, color: "#ffe6a8" },
  { name: "月球", slug: "moon", type: "planet", body: Body.Moon, color: "#e7e3d4" },
  { name: "水星", slug: "mercury", type: "planet", body: Body.Mercury, color: "#c5beb1" },
  { name: "金星", slug: "venus", type: "planet", body: Body.Venus, color: "#f0d7a4" },
  { name: "火星", slug: "mars", type: "planet", body: Body.Mars, color: "#d48767" },
  { name: "木星", slug: "jupiter", type: "planet", body: Body.Jupiter, color: "#d6bea1" },
  { name: "土星", slug: "saturn", type: "planet", body: Body.Saturn, color: "#d9c890" },
  { name: "天王星", slug: "uranus", type: "planet", body: Body.Uranus, color: "#8fd0cf" },
  { name: "海王星", slug: "neptune", type: "planet", body: Body.Neptune, color: "#7196d8" },
];

function drawDeepSkyObject(
  ctx: CanvasRenderingContext2D,
  object: CosmicCatalogObject,
  x: number,
  y: number,
  size: number,
) {
  ctx.save();
  if (object.type === "galaxy") {
    ctx.translate(x, y);
    ctx.rotate(-0.32);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.6);
    glow.addColorStop(0, `${object.color}c0`);
    glow.addColorStop(0.35, `${object.color}58`);
    glow.addColorStop(1, `${object.color}00`);
    ctx.fillStyle = glow;
    ctx.scale(1.8, 0.7);
    ctx.beginPath();
    ctx.arc(0, 0, size * 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (object.type === "nebula") {
    const haze = ctx.createRadialGradient(x - size * 0.3, y, 0, x, y, size * 2.8);
    haze.addColorStop(0, `${object.color}a8`);
    haze.addColorStop(0.45, `${object.color}42`);
    haze.addColorStop(1, `${object.color}00`);
    ctx.fillStyle = haze;
    ctx.beginPath();
    ctx.ellipse(x, y, size * 2.8, size * 1.8, 0.45, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const points = object.type === "globular_cluster" ? 17 : 11;
    for (let index = 0; index < points; index += 1) {
      const angle = index * 2.39996;
      const distance = size * (0.25 + ((index * 37) % 100) / 75);
      const px = x + Math.cos(angle) * distance;
      const py = y + Math.sin(angle) * distance * 0.72;
      ctx.globalAlpha = object.type === "globular_cluster" ? 0.78 : 0.62;
      ctx.fillStyle = object.color;
      ctx.beginPath();
      ctx.arc(px, py, index % 4 === 0 ? 1.05 : 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

const stars: StarDot[] = [
  { name: "参宿一", x: 0.50, y: 0.45, r: 0.8, color: "#c8d8ff", label: "猎户座腰带" },
  { name: "参宿二", x: 0.52, y: 0.44, r: 0.8, color: "#c8d8ff" },
  { name: "参宿三", x: 0.48, y: 0.43, r: 0.8, color: "#c8d8ff" },
  { name: "参宿四", x: 0.45, y: 0.38, r: 2.45, color: "#f0a050", label: "参宿四" },
  { name: "参宿七", x: 0.55, y: 0.52, r: 2.35, color: "#b0d0ff", label: "参宿七" },
  { name: "参宿五", x: 0.42, y: 0.47, r: 0.6, color: "#c8d8ff" },
  { name: "参宿六", x: 0.57, y: 0.40, r: 0.6, color: "#c8d8ff" },
  { name: "木星", x: 0.70, y: 0.25, r: 3.2, color: "#ffe0b0", label: "木星" },
  { name: "金星", x: 0.78, y: 0.18, r: 3.0, color: "#ffffe0", label: "金星" },
  { name: "火星", x: 0.72, y: 0.48, r: 2.2, color: "#f0a080", label: "火星" },
  { name: "土星", x: 0.58, y: 0.68, r: 2.35, color: "#f0e0c0", label: "土星" },
  { name: "织女星", x: 0.30, y: 0.20, r: 2.65, color: "#e0e8ff", label: "织女星" },
  { name: "月球", x: 0.65, y: 0.55, r: 3.4, color: "#ffffe8", label: "月球" },
  { name: "太阳", x: 0.50, y: 0.70, r: 4.5, color: "#fff0b8", label: "太阳" },
  { name: "天狼星", x: 0.60, y: 0.60, r: 3.1, color: "#e0e8ff", label: "天狼星" },
  { name: "北极星", x: 0.50, y: 0.08, r: 1.65, color: "#e8e0d0", label: "北极星" },
  { name: "猎户座", x: 0.50, y: 0.45, r: 3.0, color: "transparent", label: "猎户座" },
];

export default function StarCanvas({
  onObjectClick,
  onAimTargetChange,
  target,
  source = "primary",
  selected,
  obsTime,
  obsLocation,
  is2DMode,
  orientation,
  orionBestWindow,
  arMode = false,
}: StarCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dimsRef = useRef({
    W: 0, H: 0,
    animStart: 0, animSlug: "",
    nameToPos: new Map<string, { x: number; y: number }>(),
    nameToAlpha: new Map<string, number>(),
    hitObjects: [] as HitObject[],
    hY: 0,
  });
  const prev2DModeRef = useRef(true);
  const obsEnterTimeRef = useRef(0);
  const lastAimSlugRef = useRef<string | null>(null);
  const lastAimNearbyKeyRef = useRef("");
  const dragRef = useRef({
    active: false,
    moved: false,
    suppressClick: false,
    lastX: 0,
    lastY: 0,
  });
  const [manualViewOffset, setManualViewOffset] = useState({ az: 0, alt: 0 });
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (is2DMode) setManualViewOffset({ az: 0, alt: 0 });
  }, [is2DMode, selected?.slug, target]);

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

    // 进入观察模式的着陆过渡
    if (prev2DModeRef.current && !is2DMode) {
      obsEnterTimeRef.current = performance.now();
      const start = obsEnterTimeRef.current;
      function tick() {
        if (performance.now() - start < 450) requestAnimationFrame(tick);
        forceRender((n) => n + 1);
      }
      requestAnimationFrame(tick);
    }
    prev2DModeRef.current = !!is2DMode;
    const obsEnterAge = performance.now() - obsEnterTimeRef.current;
    const transitionAlpha = !is2DMode && obsEnterAge < 400
      ? obsEnterAge / 400
      : 1;

    // ---- 根据 obsTime 计算 MVP 对象的实时 canvas 位置 ----
    const cx = W / 2;
    const cy = H / 2;
    // 2D 星图是可平移的天区，不把完整天球强行压缩到一个手机屏幕里。
    const activeFocusedConstellation = constellationCatalog.find((constellation) =>
      constellation.slug === target
        || (selected?.type === "constellation" && constellation.slug === selected.slug)
        || (is2DMode && constellation.memberSlugs.includes(selected?.slug ?? ""))
    );
    const constellationFocus = Boolean(activeFocusedConstellation);
    const focusedMemberSlugs = new Set(activeFocusedConstellation?.memberSlugs ?? []);

    if (is2DMode) {
      const allBrightStars = activeBrightStars();
      const focusAnchor = activeFocusedConstellation
        ? allBrightStars.find((star) => star.slug === activeFocusedConstellation.anchorSlug)
        : null;
      const targetStar = allBrightStars.find((star) => star.slug === target);
      const targetDeepSky = cosmicCatalog.find((object) => object.slug === target);
      const targetBody = panoramaBodies.find((body) => body.slug === target);
      let targetBodyRaDeg: number | null = null;
      if (targetBody) {
        try {
          const targetEquator = Equator(
            targetBody.body,
            MakeTime(obsTime),
            new Observer(obsLocation.lat, obsLocation.lng, 0),
            true,
            true,
          );
          targetBodyRaDeg = targetEquator.ra * 15;
        } catch {
          targetBodyRaDeg = null;
        }
      }
      const horizontalFovDeg = constellationFocus ? 70 : W <= 640 ? 150 : 210;
      const verticalFovDeg = constellationFocus ? 78 : 180;
      const centerDecDeg = constellationFocus ? focusAnchor?.decDeg ?? 0 : 0;
      const baseCenterRaDeg = focusAnchor?.raHours != null
        ? focusAnchor.raHours * 15
        : targetDeepSky
          ? targetDeepSky.raHours * 15
          : targetStar
            ? targetStar.raHours * 15
            : targetBodyRaDeg ?? 180;
      const centerRaDeg = normalizeDegrees(baseCenterRaDeg + manualViewOffset.az);
      const mapTop = 44;
      const mapBottom = 28;
      const mapHeight = Math.max(1, H - mapTop - mapBottom);
      const project = (raHours: number, decDeg: number) => {
        const pos = projectEquatorialToPanorama({
          raHours,
          decDeg,
          centerRaDeg,
          horizontalFovDeg,
          width: W,
          height: mapHeight,
          centerDecDeg,
          verticalFovDeg,
        });
        return { x: pos.x, y: pos.y + mapTop };
      };
      const isVisible = ({ x, y }: { x: number; y: number }, margin = 24) =>
        x >= -margin && x <= W + margin && y >= mapTop - margin && y <= H - mapBottom + margin;
      const nameToPos = new Map<string, { x: number; y: number }>();
      const nameToAlpha = new Map<string, number>();
      const hitObjects: HitObject[] = [];

      ctx.fillStyle = "#070b0c";
      ctx.fillRect(0, 0, W, H);

      const skyWash = ctx.createLinearGradient(0, mapTop, 0, H - mapBottom);
      skyWash.addColorStop(0, "rgba(24,38,48,0.30)");
      skyWash.addColorStop(0.5, "rgba(7,11,12,0)");
      skyWash.addColorStop(1, "rgba(26,19,27,0.22)");
      ctx.fillStyle = skyWash;
      ctx.fillRect(0, mapTop, W, mapHeight);

      ctx.save();
      ctx.strokeStyle = "rgba(185,205,218,0.09)";
      ctx.fillStyle = "rgba(220,232,238,0.34)";
      ctx.lineWidth = 1;
      ctx.font = "10px sans-serif";
      ctx.textAlign = "left";
      for (const dec of [-60, -30, 0, 30, 60]) {
        const y = project(centerRaDeg / 15, dec).y;
        if (y < mapTop || y > H - mapBottom) continue;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.fillText(`${dec > 0 ? "+" : ""}${dec}°`, 8, y - 5);
      }
      const firstTick = Math.floor((centerRaDeg - horizontalFovDeg / 2) / 30) * 30;
      for (let tick = firstTick; tick <= centerRaDeg + horizontalFovDeg / 2 + 30; tick += 30) {
        const tickRaDeg = normalizeDegrees(tick);
        const x = project(tickRaDeg / 15, centerDecDeg).x;
        if (x < -1 || x > W + 1) continue;
        ctx.beginPath();
        ctx.moveTo(x, mapTop);
        ctx.lineTo(x, H - mapBottom);
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillText(`${Math.round(tickRaDeg / 15) % 24}h`, x, 24);
      }
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(220,232,238,0.22)";
      ctx.fillText("赤经", W - 10, 24);
      ctx.restore();

      const drawableStars = constellationFocus
        ? allBrightStars.filter((star) => focusedMemberSlugs.has(star.slug))
        : allBrightStars;
      const starBySlug = new Map(allBrightStars.map((star) => [star.slug, star]));

      ctx.save();
      ctx.strokeStyle = constellationFocus ? "rgba(132,195,208,0.58)" : "rgba(127,166,179,0.20)";
      ctx.lineWidth = constellationFocus ? 1.2 : 0.7;
      for (const constellation of constellationFocus && activeFocusedConstellation
        ? [activeFocusedConstellation]
        : constellationCatalog) {
        for (const line of constellation.lines) {
          const from = starBySlug.get(line.from);
          const to = starBySlug.get(line.to);
          if (!from || !to) continue;
          const a = project(from.raHours, from.decDeg);
          const b = project(to.raHours, to.decDeg);
          if (!isVisible(a) || !isVisible(b) || Math.abs(a.x - b.x) > W * 0.35) continue;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      ctx.restore();

      if (!constellationFocus) {
        for (const object of cosmicCatalog) {
          const pos = project(object.raHours, object.decDeg);
          if (!isVisible(pos, 36)) continue;
          const size = 3.2 + object.visualSize * 1.2;
          drawDeepSkyObject(ctx, object, pos.x, pos.y, size);
          nameToPos.set(object.nameZh, pos);
          nameToAlpha.set(object.nameZh, 1);
          hitObjects.push({
            name: object.nameZh,
            type: object.type,
            slug: object.slug,
            x: pos.x,
            y: pos.y,
            r: 13,
            isPreviewOnly: true,
          });
          ctx.save();
          ctx.font = "9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = "rgba(225,235,239,0.48)";
          ctx.fillText(object.nameZh, pos.x, pos.y + size * 2.2 + 9);
          ctx.restore();
        }
      }

      for (const star of drawableStars) {
        const pos = project(star.raHours, star.decDeg);
        if (!isVisible(pos)) continue;
        const radius = brightStarRadius(star.magnitude) * (constellationFocus ? 1.22 : 1);
        const glowRadius = Math.max(3.5, radius * 3.2);
        const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowRadius);
        glow.addColorStop(0, "rgba(232,242,255,0.88)");
        glow.addColorStop(0.28, "rgba(176,205,235,0.34)");
        glow.addColorStop(1, "rgba(145,185,222,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = star.magnitude < 0.2 ? "#fff8e7" : "#e6f0ff";
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fill();
        nameToPos.set(star.nameZh, pos);
        nameToAlpha.set(star.nameZh, 1);
        hitObjects.push({ name: star.nameZh, type: "bright_star", slug: star.slug, x: pos.x, y: pos.y, r: 11 });

        const showLabel = constellationFocus
          || star.magnitude <= 1.05
          || star.slug === selected?.slug
          || star.slug === target;
        if (showLabel) {
          ctx.save();
          ctx.font = constellationFocus ? "10px sans-serif" : "9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = constellationFocus ? "rgba(239,247,250,0.72)" : "rgba(232,241,245,0.48)";
          ctx.fillText(star.nameZh, pos.x, pos.y + radius + 11);
          ctx.restore();
        }
      }

      if (!constellationFocus) {
        try {
          const time = MakeTime(obsTime);
          const observer = new Observer(obsLocation.lat, obsLocation.lng, 0);
          for (const body of panoramaBodies) {
            const equator = Equator(body.body, time, observer, true, true);
            const pos = project(equator.ra, equator.dec);
            if (!isVisible(pos)) continue;
            const radius = body.slug === "sun" ? 5.2 : body.slug === "moon" ? 4.5 : 3.2;
            ctx.save();
            ctx.shadowColor = body.color;
            ctx.shadowBlur = body.slug === "sun" ? 14 : 7;
            ctx.fillStyle = body.color;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.fill();
            if (body.slug === "saturn") {
              ctx.strokeStyle = "rgba(225,207,154,0.75)";
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.ellipse(pos.x, pos.y, 6.2, 2.1, -0.24, 0, Math.PI * 2);
              ctx.stroke();
            }
            ctx.restore();
            ctx.save();
            ctx.font = "9px sans-serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "rgba(246,240,221,0.58)";
            ctx.fillText(body.name, pos.x, pos.y + radius + 11);
            ctx.restore();
            nameToPos.set(body.name, pos);
            nameToAlpha.set(body.name, 1);
            hitObjects.push({ name: body.name, type: body.type, slug: body.slug, x: pos.x, y: pos.y, r: 12 });
          }
        } catch {
          // Planet positions are supplemental; the fixed celestial catalog remains usable.
        }
      }

      for (const constellation of constellationFocus && activeFocusedConstellation
        ? [activeFocusedConstellation]
        : constellationCatalog) {
        const anchor = starBySlug.get(constellation.anchorSlug);
        if (!anchor) continue;
        const pos = project(anchor.raHours, anchor.decDeg);
        if (!isVisible(pos)) continue;
        const labelY = pos.y - (constellationFocus ? 24 : 16);
        ctx.save();
        ctx.font = constellationFocus ? "600 13px sans-serif" : "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = constellationFocus ? "rgba(167,220,229,0.82)" : "rgba(146,190,201,0.36)";
        ctx.fillText(constellation.nameZh, pos.x, labelY);
        ctx.restore();
        hitObjects.push({
          name: constellation.nameZh,
          type: "constellation",
          slug: constellation.slug,
          x: pos.x,
          y: labelY - 3,
          r: constellationFocus ? 16 : 12,
        });
      }

      const selectedHit = hitObjects.find((hit) => hit.slug === selected?.slug);
      if (selectedHit) {
        const pulse = 1 + Math.sin((performance.now() - dimsRef.current.animStart) / 90) * 0.08;
        ctx.save();
        ctx.strokeStyle = "rgba(119,205,215,0.72)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(selectedHit.x, selectedHit.y, 14 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      dimsRef.current.nameToPos = nameToPos;
      dimsRef.current.nameToAlpha = nameToAlpha;
      dimsRef.current.hitObjects = hitObjects;
      dimsRef.current.hY = H;
      return;
    }

    const twoDMapScale = is2DMode ? (constellationFocus ? 2.0 : 1.45) : 1;
    const rx = is2DMode ? W / 2 * 0.85 * twoDMapScale : W / 2;
    const ry = H / 2 * 0.85 * twoDMapScale;
    const vFovDeg = is2DMode ? 45 * (H / Math.max(W, H)) : constellationFocus ? 44 : 86;
    const obsAzHalfDeg = constellationFocus ? 44 : OBS_VIEW_HALF_AZ_DEG;
    const fadeVFovDeg = vFovDeg * (is2DMode ? 1 : 1.35);

    // 内容池对象坐标（RA hours, Dec degrees），对应 objectMeta 中的可点击对象
    const coordLookup: Record<string, { raH: number; decD: number; isPlanet: boolean; body?: Body }> = {
      "木星": { raH: 0, decD: 0, isPlanet: true, body: Body.Jupiter },
      "金星": { raH: 0, decD: 0, isPlanet: true, body: Body.Venus },
      "火星": { raH: 0, decD: 0, isPlanet: true, body: Body.Mars },
      "土星": { raH: 0, decD: 0, isPlanet: true, body: Body.Saturn },
      "月球": { raH: 0, decD: 0, isPlanet: true, body: Body.Moon },
      "太阳": { raH: 0, decD: 0, isPlanet: true, body: Body.Sun },
      "织女星": { raH: 18.6156, decD: 38.7837, isPlanet: false },
      "天狼星": { raH: 6.7525, decD: -16.7161, isPlanet: false },
      "参宿四": { raH: 5.9195, decD: 7.4071, isPlanet: false },
      "北极星": { raH: 2.5303, decD: 89.2641, isPlanet: false },
      "猎户座": { raH: 5.5, decD: 5.0, isPlanet: false },
      // 猎户座附属星 — 统一真实投影
      "参宿一": { raH: 5.679, decD: -1.943, isPlanet: false },
      "参宿二": { raH: 5.603, decD: -1.202, isPlanet: false },
      "参宿三": { raH: 5.533, decD: -0.299, isPlanet: false },
      "参宿七": { raH: 5.2423, decD: -8.2016, isPlanet: false },
      "参宿五": { raH: 5.419, decD: 6.350, isPlanet: false },
      "参宿六": { raH: 5.796, decD: -9.670, isPlanet: false },
    };

    // 扩展亮星层 — 观察模式全量，2D 仅亮子集（保持参考图克制）
    const staticSlugs = new Set(
      stars
        .map((s) => objectMeta[s.name]?.slug)
        .filter((slug): slug is string => Boolean(slug)),
    );
    const extendedStars = activeBrightStars()
      .filter((s) => !staticSlugs.has(s.slug))
      // 总览保持克制；进入星座视图后，当前星座的成员不再受总览星等阈值限制。
      .filter((s) => constellationFocus && !is2DMode
        ? focusedMemberSlugs.has(s.slug)
        : !is2DMode || s.magnitude < 1.5 || focusedMemberSlugs.has(s.slug))
      .map((s) => ({ name: s.nameZh, raH: s.raHours, decD: s.decDeg, mag: s.magnitude, slug: s.slug }));

    const nameToPos = new Map<string, { x: number; y: number }>();
    const nameToAlpha = new Map<string, number>();
    let skyGlow = 0;
    let nightDepth = 1;
    let sunAltitude = -90;
    try {
      const t = MakeTime(obsTime);
      const obs = new Observer(obsLocation.lat, obsLocation.lng, 0);
      if (!is2DMode) {
        const sunEq = Equator(Body.Sun, t, obs, true, true);
        const sunHor = Horizon(t, obs, sunEq.ra, sunEq.dec);
        sunAltitude = sunHor.altitude;
        skyGlow = clamp01((sunAltitude + 18) / 24);
        nightDepth = 0.06 + 1.04 * Math.pow(1 - skyGlow, 1.7);
      }

      for (const [name, c] of Object.entries(coordLookup)) {
        let alt: number, az: number;
        if (c.isPlanet && c.body) {
          const eq = Equator(c.body, t, obs, true, true);
          const hor = Horizon(t, obs, eq.ra, eq.dec);
          alt = hor.altitude; az = hor.azimuth;
        } else {
          const eq = stellarEquatorOfDate(c.raH, c.decD, obsTime);
          const hor = Horizon(t, obs, eq.ra, eq.dec);
          alt = hor.altitude; az = hor.azimuth;
        }

        // 观察模式：pitch 为有效天顶
        const viewAz = orientationViewAz(orientation, manualViewOffset.az);
        const viewAlt = orientation
          ? Math.max(-45, Math.min(90, orientation.pitch + manualViewOffset.alt))
          : is2DMode
            ? Math.max(25, Math.min(90, 90 - manualViewOffset.alt))
            : 90;
        // 是否在天空区域由真实高度、地平线和视场判断，不额外按手机俯仰角淡出目标。
        const skyFacing = 1;
        const rawEffectiveAlt = alt - viewAlt + 90;
        // effectiveAlt > 90 时做镜像映射到 0-90 区间
        const effectiveAlt = Math.max(0, rawEffectiveAlt > 90 ? 180 - rawEffectiveAlt : rawEffectiveAlt);
        // 球面角距离（真实空间判定层，用未压缩方位角）
        const signedDAz = signedAzDelta(az, viewAz);
        const dAzRad = (signedDAz * Math.PI) / 180;
        const sinVA = Math.sin((viewAlt * Math.PI) / 180);
        const cosVA = Math.cos((viewAlt * Math.PI) / 180);
        const sinA = Math.sin((alt * Math.PI) / 180);
        const cosA = Math.cos((alt * Math.PI) / 180);
        const cosAngDist = sinVA * sinA + cosVA * cosA * Math.cos(dAzRad);
        const behind = orientation && cosAngDist < -0.08;
        // 屏幕投影层：天顶附近方位角收拢
        const azCompress = orientation ? Math.cos((effectiveAlt * Math.PI) / 180) : 1;
        const azRad = dAzRad * azCompress;
        const baseDist = effectiveAlt > 0 && !behind
          ? orientation
            ? (() => {
                const linear = (1 - effectiveAlt / 90);
                const tan = Math.min(Math.tan(((90 - effectiveAlt) * Math.PI) / 180) * 0.289, 1.05);
                const blend = (90 - viewAlt) / 90; // pitch高→线性，pitch低→tan
                return blend * tan + (1 - blend) * linear;
              })()
            : (1 - effectiveAlt / 90)
          : 1.05;
        const horizontalGate = orientation ? observationHorizontalGate(signedDAz) : 1;
        nameToPos.set(name, {
          x: orientation ? cx + (signedDAz / obsAzHalfDeg) * rx : cx + Math.sin(azRad) * baseDist * rx,
          y: orientation ? cy + ((viewAlt - alt) / vFovDeg) * ry : cy - Math.cos(azRad) * baseDist * ry,
        });
        const dAlt = Math.abs(alt - viewAlt);
        const verticalGate = orientation
          ? dAlt <= vFovDeg
            ? 1
            : clamp01((fadeVFovDeg - dAlt) / (fadeVFovDeg - vFovDeg))
          : 1;
        const alpha = behind ? 0 : orientation && alt < 0 ? 0 : orientation ? horizontalGate * verticalGate : 1;
        const extinction = orientation && alpha > 0 ? Math.pow(Math.max(0.05, alt / 90), 0.30) : 1;
        const daylightObject = name === "太阳" || name === "月球" || name === "金星";
        const timeVisibility = orientation && alpha > 0
          ? name === "太阳"
            ? 1
            : daylightObject
              ? 0.22 + 0.78 * nightDepth
              : nightDepth * altitudeVisibility(alt)
          : 1;
        nameToAlpha.set(name, clamp01(alpha * extinction * timeVisibility * skyFacing));
      }
    // 扩展亮星位置计算
    for (const s of extendedStars) {
      const eq = stellarEquatorOfDate(s.raH, s.decD, obsTime);
      const hor = Horizon(t, obs, eq.ra, eq.dec);
      const alt = hor.altitude; const az = hor.azimuth;

      const viewAz = orientationViewAz(orientation, manualViewOffset.az);
      const viewAlt = orientation
        ? Math.max(-45, Math.min(90, orientation.pitch + manualViewOffset.alt))
        : is2DMode
          ? Math.max(25, Math.min(90, 90 - manualViewOffset.alt))
          : 90;
      const skyFacing = 1;
      const rawEffectiveAlt = alt - viewAlt + 90;
      const effectiveAlt = Math.max(0, rawEffectiveAlt > 90 ? 180 - rawEffectiveAlt : rawEffectiveAlt);
      const signedDAzE = signedAzDelta(az, viewAz);
      const dAzRadE = (signedDAzE * Math.PI) / 180;
      const sinVAe = Math.sin((viewAlt * Math.PI) / 180);
      const cosVAe = Math.cos((viewAlt * Math.PI) / 180);
      const sinAe = Math.sin((alt * Math.PI) / 180);
      const cosAe = Math.cos((alt * Math.PI) / 180);
      const behind = orientation && (sinVAe * sinAe + cosVAe * cosAe * Math.cos(dAzRadE)) < -0.08;
      const azCompressE = orientation ? Math.cos((effectiveAlt * Math.PI) / 180) : 1;
      const azRad = dAzRadE * azCompressE;
      const baseDist = effectiveAlt > 0 && !behind
        ? orientation
          ? (() => {
              const linearE = (1 - effectiveAlt / 90);
              const tanE = Math.min(Math.tan(((90 - effectiveAlt) * Math.PI) / 180) * 0.289, 1.05);
              const blendE = (90 - viewAlt) / 90;
              return blendE * tanE + (1 - blendE) * linearE;
            })()
          : (1 - effectiveAlt / 90)
        : 1.05;
      const horizontalGateE = orientation ? observationHorizontalGate(signedDAzE) : 1;
      nameToPos.set(s.name, {
        x: orientation ? cx + (signedDAzE / obsAzHalfDeg) * rx : cx + Math.sin(azRad) * baseDist * rx,
        y: orientation ? cy + ((viewAlt - alt) / vFovDeg) * ry : cy - Math.cos(azRad) * baseDist * ry,
      });
      const dAltE = Math.abs(alt - viewAlt);
      const verticalGateE = orientation
        ? dAltE <= vFovDeg
          ? 1
          : clamp01((fadeVFovDeg - dAltE) / (fadeVFovDeg - vFovDeg))
        : 1;
      const alphaE = behind ? 0 : orientation && alt < 0 ? 0 : orientation ? horizontalGateE * verticalGateE : 1;
      const extinctionE = orientation && alphaE > 0 ? Math.pow(Math.max(0.05, alt / 90), 0.30) : 1;
      const timeVisibilityE = orientation && alphaE > 0 ? nightDepth * altitudeVisibility(alt) : 1;
      nameToAlpha.set(s.name, clamp01(alphaE * extinctionE * timeVisibilityE * skyFacing));
    }

    } catch { /* fallback to hardcoded positions */ }

    // 搜索命中后的轻聚焦 — 仅 source=search
    // 将目标向中心拉近 40%，所有对象跟随偏移
    if (is2DMode && source === "search" && target) {
      const targetConstellation = getConstellation(target);
      const targetName = targetConstellation
        ? getConstellationMembers(targetConstellation).find((star) => star.slug === targetConstellation.anchorSlug)?.nameZh
        : slugToStarName[target];
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
    dimsRef.current.nameToAlpha = nameToAlpha;
    const dayAmount = !is2DMode ? clamp01((sunAltitude + 6) / 18) : 0;
    const twilightAmount = !is2DMode ? clamp01((sunAltitude + 18) / 18) * (1 - dayAmount * 0.65) : 0;

    if (!arMode) {
      // 夜空渐变背景
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.15, 0, W * 0.5, H * 0.5, W * 0.8);
      bg.addColorStop(0, "#0a1628");
      bg.addColorStop(0.5, "#060e1c");
      bg.addColorStop(1, "#070b0c");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      if (!is2DMode && twilightAmount > 0.01) {
        ctx.save();
        ctx.globalAlpha = 0.52 * twilightAmount;
        const twilight = ctx.createLinearGradient(0, 0, 0, H);
        twilight.addColorStop(0, "#253b5e");
        twilight.addColorStop(0.62, "#66758d");
        twilight.addColorStop(1, "#9a8b70");
        ctx.fillStyle = twilight;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      if (!is2DMode && dayAmount > 0.01) {
        ctx.save();
        ctx.globalAlpha = 0.92 * dayAmount;
        const daySky = ctx.createLinearGradient(0, 0, 0, H);
        daySky.addColorStop(0, "#7899c6");
        daySky.addColorStop(0.58, "#93acd0");
        daySky.addColorStop(1, "#c7c0ae");
        ctx.fillStyle = daySky;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      // 微弱银河光带
      ctx.save();
      ctx.globalAlpha = is2DMode ? 0.03 : 0.13 * clamp01(nightDepth);
      const mw = ctx.createLinearGradient(W * 0.2, H * 0.3, W * 0.7, H * 0.7);
      mw.addColorStop(0, "transparent");
      mw.addColorStop(0.4, "#8090c0");
      mw.addColorStop(0.6, "#8090c0");
      mw.addColorStop(1, "transparent");
      ctx.fillStyle = mw;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      if (!is2DMode && nightDepth > 0.18) {
      ctx.save();
      ctx.globalAlpha = 0.16 * clamp01(nightDepth);
      ctx.translate(W * 0.48, H * 0.54);
      ctx.rotate(-0.42);
      const band = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(W, H) * 0.62);
      band.addColorStop(0, "rgba(200,210,180,0.46)");
      band.addColorStop(0.34, "rgba(120,160,170,0.22)");
      band.addColorStop(0.72, "rgba(60,80,120,0.10)");
      band.addColorStop(1, "transparent");
      ctx.scale(1.8, 0.22);
      ctx.fillStyle = band;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(W, H) * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.18 * clamp01(nightDepth);
      ctx.fillStyle = "rgba(210,230,220,0.75)";
      for (let i = 0; i < 120; i++) {
        const x = (i * 41) % W;
        const y = H * 0.48 + Math.sin(i * 0.83) * H * 0.16 + ((i * 17) % 28) - 14;
        const r = 0.45 + (i % 5) * 0.16;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

      // 观察模式：天空明暗跟随太阳高度，时间滑动时会真实变亮/变暗
      if (!is2DMode && skyGlow > 0.01 && dayAmount < 0.85) {
      ctx.save();
      ctx.globalAlpha = (0.08 + 0.24 * skyGlow) * (1 - dayAmount);
      const twilightSky = ctx.createLinearGradient(0, 0, 0, H);
      twilightSky.addColorStop(0, "#16233a");
      twilightSky.addColorStop(0.45, "#20334c");
      twilightSky.addColorStop(1, "#2a2a26");
      ctx.fillStyle = twilightSky;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      }
    }

    // 地平线裁切阈值 — observation 模式星点不进入地面
    const hClipY = orientation
      ? (() => {
          const rawHY = cy + (Math.max(-45, Math.min(90, orientation.pitch + manualViewOffset.alt)) / vFovDeg) * ry + H * 0.20;
          return Math.max(H * 0.70, Math.min(H * 0.94, rawHY));
        })()
      : H + 1;
    dimsRef.current.hY = hClipY;
    const visualHorizonY = !is2DMode ? Math.max(H * 0.78, Math.min(H * 0.90, hClipY)) : hClipY;
    const hitObjects: HitObject[] = [];
    const skyClipMargin = !is2DMode ? 2 : 0;
    const isInSkyArea = (screenY: number) =>
      is2DMode || screenY < hClipY - skyClipMargin;
    const isNearScreenX = (screenX: number, margin = 42) =>
      screenX >= -margin && screenX <= W + margin;

    // 三种模式共用方向标尺：2D 使用手指拖动后的视场方向，观察/AR 使用设备当前朝向。
    const compassAzimuth = orientationViewAz(orientation, manualViewOffset.az);
    const compassDirections = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
    const compassIndex = ((Math.round(compassAzimuth / 45) % compassDirections.length) + compassDirections.length) % compassDirections.length;
    const compassDirection = compassDirections[compassIndex];
    const compassLineOffsets = [-90, -45, 0, 45, 90];
    const compassLineDirections = compassLineOffsets.map((offset) => {
      const index = ((Math.round((compassAzimuth + offset) / 45) % compassDirections.length) + compassDirections.length) % compassDirections.length;
      return compassDirections[index];
    });
    const compassY = Math.max(28, Math.min(H * 0.10, 54));
    ctx.save();
    ctx.globalAlpha = arMode ? 0.78 : is2DMode ? 0.38 : 0.52;
    ctx.strokeStyle = arMode ? "rgba(180,240,220,0.6)" : "rgba(220,235,245,0.42)";
    ctx.fillStyle = arMode ? "rgba(225,255,245,0.82)" : "rgba(235,245,250,0.62)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(W * 0.08, compassY);
    ctx.lineTo(W * 0.92, compassY);
    ctx.stroke();
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.beginPath();
    ctx.moveTo(cx, compassY - 9);
    ctx.lineTo(cx, compassY + 9);
    ctx.stroke();
    ctx.fillText(`${compassDirection} ${Math.round(compassAzimuth) % 360}°`, cx, compassY - 10);
    ctx.font = "9px sans-serif";
    ctx.fillStyle = arMode ? "rgba(225,255,245,0.58)" : "rgba(235,245,250,0.46)";
    ctx.textAlign = "center";
    for (const [index, direction] of compassLineDirections.entries()) {
      ctx.fillText(direction, W * (0.10 + index * 0.20), compassY + 16);
    }
    ctx.restore();

    const retainNamedStarAlpha = (name: string, alpha: number, screenX: number) => {
      const meta = objectMeta[name];
      if (is2DMode || !meta || meta.type !== "bright_star" || alpha <= 0 || !isNearScreenX(screenX)) {
        return alpha;
      }
      return Math.max(alpha, NAMED_STAR_EDGE_ALPHA);
    };

    for (const s of stars) {
      if (s.color === "transparent") continue; // 仅作为点击区域，不绘制星点

      const pos = nameToPos.get(s.name);
      const cx = pos ? pos.x : s.x * W;
      const cy = pos ? pos.y : s.y * H;
      // 星点天地裁切 — 不进入地面区域
      if (!isInSkyArea(cy)) continue;
      const meta = objectMeta[s.name];
      if (constellationFocus && !is2DMode && (!meta || meta.type !== "bright_star" || !focusedMemberSlugs.has(meta.slug))) continue;
      if (!constellationFocus && meta?.type === "bright_star" && CONSTELLATION_MEMBER_SLUGS.has(meta.slug)) continue;
      const isNamedBrightStar = meta?.type === "bright_star";
      if (!is2DMode && (isNamedBrightStar ? !isNearScreenX(cx) : (cx < -24 || cx > W + 24))) continue;
      const rawObjAlpha = nameToAlpha.get(s.name) ?? 1;
      const objAlpha = retainNamedStarAlpha(s.name, rawObjAlpha, cx);
      if (!is2DMode && objAlpha < (isNamedBrightStar ? NAMED_STAR_EDGE_ALPHA : 0.03)) continue;

      // 猎户座关键亮星最佳时段轻增强
      const orionBoost = !is2DMode && orionBestWindow && (s.name === "参宿四" || s.name === "参宿七") ? 1.3 : 1;
      const isSun = s.name === "太阳";
      const isMoon = s.name === "月球";
      if (meta) {
        hitObjects.push({
          name: s.name,
          type: meta.type,
          slug: meta.slug,
          x: cx,
          y: cy,
          r: Math.max(s.r * 12, 44),
        });
      }

      if (!is2DMode && isSun) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.9, 0.18 + 0.62 * objAlpha);
        const sunGlow = ctx.createRadialGradient(cx, cy, s.r * 1.5, cx, cy, s.r * 24);
        sunGlow.addColorStop(0, "rgba(255,244,190,0.95)");
        sunGlow.addColorStop(0.34, "rgba(255,226,145,0.34)");
        sunGlow.addColorStop(1, "transparent");
        ctx.fillStyle = sunGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, s.r * 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = Math.min(1, 0.45 + 0.45 * objAlpha);
        ctx.strokeStyle = "rgba(255,238,180,0.55)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, s.r * 2.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (!is2DMode && isMoon) {
        ctx.save();
        ctx.globalAlpha = 0.10 + 0.22 * objAlpha;
        const moonGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, s.r * 12);
        moonGlow.addColorStop(0, "rgba(245,248,255,0.55)");
        moonGlow.addColorStop(1, "transparent");
        ctx.fillStyle = moonGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, s.r * 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (s.r > 0.8) {
        ctx.save();
        ctx.globalAlpha = (!is2DMode ? 0.22 : 0.12) * orionBoost;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s.r * (!is2DMode ? 7 : 5));
        g.addColorStop(0, s.color);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, s.r * (!is2DMode ? 7 : 5), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = Math.min(1, objAlpha * orionBoost * (!is2DMode ? (arMode ? 1.45 : 1.25) : 1));
      const renderR = !is2DMode ? s.r * 1.25 : s.r;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, renderR * 1.8);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.3, s.color);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, renderR * (!is2DMode ? 2.1 : 1.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 观察模式：亮星暖色微散 — 大气散射使亮星边缘带极轻暖光
      if (!is2DMode && clickableStars.has(s.name) && s.r > 0.8) {
        ctx.save();
        ctx.globalAlpha = 0.025 * objAlpha * orionBoost;
        const warmGlow = ctx.createRadialGradient(cx, cy, s.r * 1.2, cx, cy, s.r * 7);
        warmGlow.addColorStop(0, "#ffd8b0");
        warmGlow.addColorStop(1, "transparent");
        ctx.fillStyle = warmGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, s.r * 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // slug → star name 反向查找（selected 使用）
    const findStarByName = (name: string): StarDot | null => {
      const staticStar = stars.find((s) => s.name === name);
      if (staticStar) return staticStar;
      const extended = extendedStars.find((s) => s.name === name);
      if (!extended) return null;
      return {
        name: extended.name,
        x: 0.5,
        y: 0.5,
        r: brightStarRadius(extended.mag),
        color: "#b0c8e8",
        label: extended.name,
      };
    };

    const findStarBySlug = (slug: string) => {
      const constellation = getConstellation(slug);
      if (constellation) {
        const anchor = constellation
          ? getConstellationMembers(constellation).find((star) => star.slug === constellation.anchorSlug)
          : null;
        return anchor ? findStarByName(anchor.nameZh) : null;
      }
      const staticStar = stars.find((s) => objectMeta[s.name]?.slug === slug);
      if (staticStar) return staticStar;
      const extended = extendedStars.find((s) => s.slug === slug);
      return extended ? findStarByName(extended.name) : null;
    };

    const selectedStar = selected ? findStarBySlug(selected.slug) : null;
    const targetConstellation = target ? getConstellation(target) : null;
    const selectedConstellation = selected ? getConstellation(selected.slug) : null;
    const targetName = targetConstellation
      ? findStarBySlug(targetConstellation.slug)?.name ?? null
      : target ? slugToStarName[target] : null;
    const targetStar = targetName ? findStarByName(targetName) : null;
    const selectedIsTarget =
      selectedStar && targetStar && selectedStar.name === targetStar.name;

    // 扩展亮星 — 视觉介于核心对象与背景星点之间
    for (const s of extendedStars) {
      const pos = nameToPos.get(s.name);
      if (!pos) continue;
      if (!constellationFocus && CONSTELLATION_MEMBER_SLUGS.has(s.slug)) continue;
      const cx = pos.x; const cy = pos.y;
      if (!isInSkyArea(cy)) continue;
      if (!is2DMode && !isNearScreenX(cx)) continue;
      const rawExLa = nameToAlpha.get(s.name) ?? 1;
      const exLa = retainNamedStarAlpha(s.name, rawExLa, cx);
      if (!is2DMode && exLa < NAMED_STAR_EDGE_ALPHA) continue;
      // 半径：亮星（低星等）更大，范围 0.45–1.35
      const r = brightStarRadius(s.mag);
      hitObjects.push({
        name: s.name,
        type: "bright_star",
        slug: s.slug,
        x: cx,
        y: cy,
        r: Math.max(r * 16, 50),
      });

      // 星点本体
      ctx.save();
      ctx.globalAlpha = (!is2DMode ? (arMode ? 0.92 : 0.78) : 0.55) * exLa;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * (!is2DMode ? 2.4 : 1.3));
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.4, "#b0c8e8");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r * (!is2DMode ? 2.7 : 2), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 轻标签 — 规则驱动：2D 仅最亮星，observation 放宽且有可见度门槛
      const isFocusedMember = constellationFocus && focusedMemberSlugs.has(s.slug);
      const showLabel = isFocusedMember || !is2DMode
        ? exLa >= NAMED_STAR_LABEL_ALPHA
        : s.mag < 1.0;
      if (showLabel) {
        ctx.save();
        ctx.font = isFocusedMember ? "10px sans-serif" : !is2DMode ? "9.5px sans-serif" : "9px sans-serif";
        ctx.textAlign = "center";
        const la = isFocusedMember
          ? Math.min(0.58, 0.26 + 0.32 * exLa)
          : is2DMode
            ? 0.12
            : Math.min(0.62, (arMode ? 0.24 : 0.16) + (arMode ? 0.34 : 0.26) * exLa);
        ctx.fillStyle = `rgba(255,255,255,${la.toFixed(2)})`;
        ctx.fillText(s.name, cx, cy + r + 9);
        ctx.restore();
      }
    }

    // 目标引导高亮 — 仅在无 selected 或 selected 不等于 target 时显示
    // selected 等于 target 时降权为极轻，selected 不等于 target 时完全消失
    const focusedConstellation = Boolean(activeFocusedConstellation);
    const focusedConstellationData = activeFocusedConstellation;
    if (!focusedConstellation) {
      ctx.save();
      ctx.globalAlpha = is2DMode ? 0.07 : arMode ? 0.16 : 0.13;
      ctx.strokeStyle = arMode ? "rgba(110,231,183,0.82)" : "rgba(143,198,224,0.78)";
      ctx.lineWidth = is2DMode ? 0.6 : 0.8;
      for (const constellation of constellationCatalog) {
        const namesBySlug = new Map(
          getConstellationMembers(constellation).map((star) => [star.slug, star.nameZh]),
        );
        for (const line of constellation.lines) {
          const from = namesBySlug.get(line.from);
          const to = namesBySlug.get(line.to);
          if (from && to) drawNamedLine(ctx, nameToPos, nameToAlpha, from, to, isInSkyArea);
        }
      }
      ctx.restore();
    }
    if (focusedConstellationData) {
      const members = getConstellationMembers(focusedConstellationData);
      const namesBySlug = new Map(members.map((star) => [star.slug, star.nameZh]));
      if (focusedConstellation) {
        ctx.save();
        ctx.globalAlpha = is2DMode ? 0.2 : arMode ? 0.42 : 0.3;
        ctx.strokeStyle = arMode ? "rgba(110,231,183,0.86)" : "rgba(143,198,224,0.82)";
        ctx.lineWidth = is2DMode ? 0.7 : 1;
        for (const line of focusedConstellationData.lines) {
          const from = namesBySlug.get(line.from);
          const to = namesBySlug.get(line.to);
          if (from && to) drawNamedLine(ctx, nameToPos, nameToAlpha, from, to, isInSkyArea);
        }
        ctx.restore();
      }

      const anchor = members.find((star) => star.slug === focusedConstellationData.anchorSlug);
      const anchorName = anchor?.nameZh;
      const anchorPos = anchorName ? nameToPos.get(anchorName) : null;
      const anchorAlpha = anchorName ? nameToAlpha.get(anchorName) ?? 0 : 0;
      if (anchorPos && anchorName && isInSkyArea(anchorPos.y) && anchorAlpha > 0.04) {
        const labelY = anchorPos.y - 30;
        hitObjects.push({
          name: focusedConstellationData.nameZh,
          type: "constellation",
          slug: focusedConstellationData.slug,
          x: anchorPos.x,
          y: labelY,
          r: 28,
        });
        ctx.save();
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(180,230,238,${Math.min(0.72, 0.28 + anchorAlpha * 0.5).toFixed(2)})`;
        const constellationLabel = focusedConstellation
          ? `${focusedConstellationData.nameZh} · ${members.length}\u9897\u6210\u5458\u661f`
          : focusedConstellationData.nameZh;
        ctx.fillText(constellationLabel, anchorPos.x, labelY);
        ctx.restore();
      }
    }

    if (!focusedConstellation) {
      for (const constellation of constellationCatalog) {
        const members = getConstellationMembers(constellation);
        const anchor = members.find((star) => star.slug === constellation.anchorSlug);
        const anchorName = anchor?.nameZh;
        const anchorPos = anchorName ? nameToPos.get(anchorName) : null;
        const anchorAlpha = anchorName ? nameToAlpha.get(anchorName) ?? 0 : 0;
        if (!anchorPos || !anchorName || !isInSkyArea(anchorPos.y) || anchorAlpha <= 0.04) continue;
        const labelY = anchorPos.y - 30;
        hitObjects.push({
          name: constellation.nameZh,
          type: "constellation",
          slug: constellation.slug,
          x: anchorPos.x,
          y: labelY,
          r: 28,
        });
        ctx.save();
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(180,220,230,${Math.min(0.5, 0.18 + anchorAlpha * 0.3).toFixed(2)})`;
        ctx.fillText(constellation.nameZh, anchorPos.x, labelY);
        ctx.restore();
      }
    }

    if (target && targetStar && !selectedIsTarget) {
      const tPos = nameToPos.get(targetStar.name);
      const tx = tPos ? tPos.x : targetStar.x * W;
      const ty = tPos ? tPos.y : targetStar.y * H;
      const tAlpha = retainNamedStarAlpha(targetStar.name, nameToAlpha.get(targetStar.name) ?? 1, tx);
      // 天地裁切 — 目标进入地面区域时不绘制引导层
      if (!is2DMode && (!isInSkyArea(ty) || tAlpha < 0.025)) {
        // skip target rendering
      } else {
      const isSearch = source === "search";
      const isPrimary = source === "primary";
      const isRelated = source === "related";
      const hasSelected = selectedStar != null;
      // ring radius: keep the guide visible without covering nearby stars
      const scale = isSearch ? 4 : isPrimary ? 3 : isRelated ? 2.75 : 2.5;
      const minR = isSearch ? 22 : isPrimary ? 18 : isRelated ? 16 : 13;
      // 接近感半径梯度：目标越靠近视野中心，辉光环越大
      // 确认态增强：进入中心 30% 区域时环额外放大、标签更明显
      const isConfirmed = !is2DMode && tAlpha > 0.7;
      const confirmBoost = isConfirmed ? 0.25 : 0;
      const rawProximity = 1.0 + 0.6 * tAlpha + confirmBoost;
      // 未接近段底限 — tAlpha<0.3 时环尺寸不低于 1.15×，保留轻存在感
      const proximity = !is2DMode
        ? (tAlpha < 0.3 ? Math.max(rawProximity, 1.15) : rawProximity)
        : 1;
      const tr = Math.max(targetStar.r * scale, minR) * proximity;
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

      // 目标标签 — 观察模式显示目标名，2D 模式显示"先看这里"
      if (!hasSelected) {
        ctx.save();
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        if (!is2DMode) {
          const tLabel = targetConstellation?.nameZh || targetStar.label || targetStar.name;
          const labelBase = isConfirmed ? 0.45 : 0.35;
          ctx.fillStyle = `rgba(240,165,74,${(labelBase * tAlpha).toFixed(2)})`;
          ctx.fillText(tLabel, tx, ty - tr * 1.1);
        } else if (isPrimary) {
          ctx.fillStyle = "rgba(240,165,74,0.45)";
          ctx.fillText("先看这里", tx, ty - tr * 1.1);
        }
        ctx.restore();
      }
      } // end hClipY guard
    }

    // selectedObject 选中态 — 最高视觉优先级，独立样式
    if (selectedStar) {
      const sPos = nameToPos.get(selectedStar.name);
      const sx = sPos ? sPos.x : selectedStar.x * W;
      const sy = sPos ? sPos.y : selectedStar.y * H;
      const sAlpha = retainNamedStarAlpha(selectedStar.name, nameToAlpha.get(selectedStar.name) ?? 1, sx);
      // 天地裁切 — 选中对象进入地面区域时不绘制高亮
      if (!is2DMode && (!isInSkyArea(sy) || sAlpha < 0.025)) {
        // skip selected rendering
      } else {
      // Visual selection only; hit testing stays unchanged below.
      const compactViewport = Math.min(W, H) < 600;
      const observationSelectionMin = compactViewport ? 22 : 28;
      const sr = !is2DMode
        ? Math.max(selectedStar.r * (arMode ? 3.5 : 3.2), observationSelectionMin)
        : Math.max(selectedStar.r * 3, 20);

      // 选中外圈：蓝白冷色环
      ctx.save();
      ctx.globalAlpha = !is2DMode ? 0.28 : 0.18;
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
      ctx.globalAlpha = !is2DMode ? 0.20 : 0.12;
      const sInner = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 0.5);
      sInner.addColorStop(0, "#c0dfff");
      sInner.addColorStop(1, "transparent");
      ctx.fillStyle = sInner;
      ctx.beginPath();
      ctx.arc(sx, sy, sr * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (!is2DMode) {
        ctx.save();
        ctx.font = `${compactViewport ? 10 : 12}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(220,238,255,${Math.min(0.78, 0.36 + sAlpha * 0.42).toFixed(2)})`;
        ctx.fillText(selectedConstellation?.nameZh || selectedStar.label || selectedStar.name, sx, sy - sr * 0.92);
        ctx.restore();
      }
      } // end hClipY guard
    }

    // 选中变化时的短暂扩散动画效果 — 外圈先扩后收
    const animTime = dimsRef.current;
    const now = performance.now();
    const animAge = now - animTime.animStart;
    if (animTime.animSlug && animAge < 500) {
      const animStar = findStarBySlug(animTime.animSlug);
      if (animStar) {
        const t = animAge / 500; // 0→1
        const ease = 1 - Math.pow(1 - t, 3); // ease-out
        const aPos = nameToPos.get(animStar.name);
        const ax = aPos ? aPos.x : animStar.x * W;
        const ay = aPos ? aPos.y : animStar.y * H;
        const aAlpha = retainNamedStarAlpha(animStar.name, nameToAlpha.get(animStar.name) ?? 1, ax);
        if (is2DMode || (isInSkyArea(ay) && aAlpha >= 0.025)) {
          const ar = Math.max(animStar.r * 2.2, 14) * (1 + ease * 0.6);

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
    }

    // 星座连线 — 观察模式默认隐藏，相关目标接近时弱出现
    const relevantOrion = target === "orion" || target === "betelgeuse";
    const tAlphaOrion = targetStar ? (nameToAlpha.get(targetStar.name) ?? 0) : 0;
    const showOrion = relevantOrion && tAlphaOrion > 0.5;
    if (!showOrion) { /* 仅 observation 模式且相关目标接近时显示 */ }
    else {
    ctx.save();
    ctx.globalAlpha = 0.06;
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
    }

    if (!is2DMode) {
      ctx.save();
      ctx.globalAlpha = 0.24 * clamp01(nightDepth);
      ctx.strokeStyle = "rgba(150,210,230,0.70)";
      ctx.lineWidth = 0.85;
      const namedLines: Array<[string, string]> = [
        ["天枢", "天璇"],
        ["天璇", "天玑"],
        ["天玑", "天权"],
        ["天权", "玉衡"],
        ["玉衡", "开阳"],
        ["开阳", "摇光"],
        ["北河二", "北河三"],
        ["壁宿二", "奎宿九"],
        ["奎宿九", "娄宿三"],
        ["箕宿一", "箕宿二"],
        ["箕宿二", "箕宿三"],
        ["箕宿二", "斗宿二"],
        ["斗宿二", "建增二"],
        ["斗宿二", "斗宿四"],
        ["斗宿四", "斗宿一"],
        ["斗宿一", "斗宿五"],
        ["斗宿一", "箕宿三"],
        ["箕宿三", "天渊三"],
        ["天渊三", "狗国一"],
      ];
      for (const [a, b] of namedLines) {
        drawNamedLine(ctx, nameToPos, nameToAlpha, a, b, isInSkyArea);
      }
      ctx.restore();
    }

    ctx.save();
    ctx.textAlign = "center";
    for (const s of stars) {
      if (!s.label) continue;
      const pos = nameToPos.get(s.name);
      const cx = pos ? pos.x : s.x * W;
      const cy = pos ? pos.y : s.y * H;
      const isMain = clickableStars.has(s.name);
      const meta = objectMeta[s.name];
      const isNamedBrightStar = meta?.type === "bright_star";
      const la = retainNamedStarAlpha(s.name, nameToAlpha.get(s.name) ?? 1, cx);
      if (!is2DMode && (!isInSkyArea(cy) || la < (isNamedBrightStar ? NAMED_STAR_LABEL_ALPHA : 0.08))) continue;
      const isDayBody = !is2DMode && (s.name === "太阳" || s.name === "月球");
      ctx.font = isDayBody ? "11px sans-serif" : isMain ? "9.5px sans-serif" : "8.5px sans-serif";
      ctx.fillStyle = isDayBody
        ? `rgba(255,248,220,${(0.58 * la).toFixed(2)})`
        : isMain
          ? `rgba(255,255,255,${(0.34 * la).toFixed(2)})`
          : `rgba(255,255,255,${(0.18 * la).toFixed(2)})`;
      ctx.fillText(s.label, cx, cy + s.r + 10);
    }
    ctx.restore();

    // 地平线参考环 — 仅 2D 星图模式
    if (is2DMode) {
      ctx.save();
      ctx.globalAlpha = 0.04;
      ctx.strokeStyle = "#8090b0";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 观察模式：仅显示 "N" 方向锚点（投影边缘，az=0° 位置）
    if (!is2DMode && orientation) {
      const nAzRad = (((0 - orientationViewAz(orientation, manualViewOffset.az) + 540) % 360) * Math.PI) / 180;
      const nx = cx + Math.sin(nAzRad) * 0.92 * rx;
      const ny = cy - Math.cos(nAzRad) * 0.92 * ry;
      ctx.save();
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillText("N", nx, ny);
      ctx.restore();
    }

    // NESW 方位标签 — 仅 2D 星图模式
    if (is2DMode) {
      ctx.save();
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.textAlign = "center";
      ctx.fillText("N", W * 0.5, 16);
      ctx.fillText("E", W - 16, H * 0.5);
      ctx.fillText("S", W * 0.5, H - 12);
      ctx.fillText("W", 16, H * 0.5);
      ctx.restore();
    }

    // 观察模式：视点标记 + 暗角 + 地面阴影
    if (!arMode && !is2DMode && transitionAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = transitionAlpha;
      // 视点锚 — 微型空心圆
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = "#8090b0";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 方向锚点 — 当前朝向八方向提示，底部地面区域
      if (orientation) {
        const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
        const dirIdx = Math.round(orientationViewAz(orientation, manualViewOffset.az) / 45) % 8;
        ctx.save();
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        ctx.fillText(dirs[dirIdx], cx, H * 0.94);
        ctx.restore();

      }

      const vR = Math.sqrt(rx * ry);
      const vignette = ctx.createRadialGradient(cx, cy, vR * 0.7, cx, cy, vR * 1.3);
      vignette.addColorStop(0, "transparent");
      vignette.addColorStop(1, "rgba(0,0,0,0.06)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);

      // 可见地景锚点与星体裁切解耦：星不进地，但不显示一条随 pitch 上下跳动的硬线
      const hY = visualHorizonY;

      // 天地分界光带 — 地平线处的带状交界层
      const glowHalf = Math.max(4, H * 0.04);
      const glowTop = Math.max(0, hY - glowHalf);
      const glowBot = Math.min(H, hY + glowHalf * 0.7);
      const hGlow = ctx.createLinearGradient(0, glowTop, 0, glowBot);
      hGlow.addColorStop(0, "transparent");
      hGlow.addColorStop(0.3, "rgba(40,34,26,0.10)");
      hGlow.addColorStop(0.6, "rgba(8,6,4,0.04)");
      hGlow.addColorStop(1, "transparent");
      ctx.fillStyle = hGlow;
      ctx.fillRect(0, glowTop, W, glowBot - glowTop);

      // 地面 — 固定底部剪影，避免贴图感和低头时放大
      const gTop = Math.max(Math.min(H, hY), H * 0.76);
      const groundHeight = H - gTop;
      if (groundHeight > 1) {
        const ground = ctx.createLinearGradient(0, gTop, 0, H);
        ground.addColorStop(0, dayAmount > 0.4 ? "rgba(42,54,34,0.28)" : "rgba(3,7,8,0.32)");
        ground.addColorStop(0.38, dayAmount > 0.4 ? "rgba(36,48,28,0.62)" : "rgba(2,5,6,0.72)");
        ground.addColorStop(1, dayAmount > 0.4 ? "rgba(15,23,13,0.92)" : "rgba(0,0,0,0.96)");
        ctx.fillStyle = ground;
        ctx.fillRect(0, gTop, W, groundHeight);

        if (dayAmount > 0.01) {
          ctx.save();
          ctx.globalAlpha = 0.34 * dayAmount;
          const dayGround = ctx.createLinearGradient(0, gTop, 0, H);
          dayGround.addColorStop(0, "#405339");
          dayGround.addColorStop(0.65, "#27331f");
          dayGround.addColorStop(1, "#10170d");
          ctx.fillStyle = dayGround;
          ctx.fillRect(0, gTop, W, groundHeight);
          ctx.restore();
        }

        if (twilightAmount > 0.01) {
          ctx.save();
          ctx.globalAlpha = 0.36 * twilightAmount;
          const warmGround = ctx.createLinearGradient(0, gTop, 0, H);
          warmGround.addColorStop(0, "#5d5336");
          warmGround.addColorStop(1, "#2c2718");
          ctx.fillStyle = warmGround;
          ctx.fillRect(0, gTop, W, groundHeight);
          ctx.restore();
        }

        ctx.save();
        ctx.globalAlpha = 0.16 + 0.18 * dayAmount;
        const pathTop = gTop + groundHeight * 0.24;
        const pathBottom = H;
        const pathTopW = W * 0.08;
        const pathBottomW = W * 0.34;
        const pathCx = W * 0.5 + Math.sin(((orientationViewAz(orientation, manualViewOffset.az)) * Math.PI) / 180) * W * 0.035;
        const path = ctx.createLinearGradient(0, pathTop, 0, pathBottom);
        path.addColorStop(0, dayAmount > 0.4 ? "rgba(109,101,66,0.25)" : "rgba(35,31,22,0.22)");
        path.addColorStop(1, dayAmount > 0.4 ? "rgba(126,111,67,0.58)" : "rgba(26,23,17,0.50)");
        ctx.fillStyle = path;
        ctx.beginPath();
        ctx.moveTo(pathCx - pathTopW, pathTop);
        ctx.quadraticCurveTo(pathCx - W * 0.08, gTop + groundHeight * 0.58, pathCx - pathBottomW, pathBottom);
        ctx.lineTo(pathCx + pathBottomW, pathBottom);
        ctx.quadraticCurveTo(pathCx + W * 0.08, gTop + groundHeight * 0.58, pathCx + pathTopW, pathTop);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.24 + 0.30 * dayAmount;
        for (let i = 0; i < 760; i++) {
          const x = (i * 47 + ((i * 19) % 31)) % W;
          const y = gTop + ((i * 83 + ((i * 7) % 23)) % Math.max(2, groundHeight));
          const size = 0.55 + ((i * 19) % 26) / 9;
          const hue = i % 7;
          ctx.fillStyle = dayAmount > 0.45
            ? hue === 0 ? "rgba(198,177,97,0.34)" : hue === 1 ? "rgba(118,132,66,0.32)" : hue === 2 ? "rgba(80,100,53,0.30)" : "rgba(48,69,38,0.24)"
            : hue === 0 ? "rgba(68,61,37,0.28)" : hue === 1 ? "rgba(34,45,28,0.30)" : "rgba(9,14,10,0.24)";
          ctx.fillRect(x, y, size * 1.6, Math.max(0.7, size * 0.55));
        }
        ctx.restore();

        const ridgeBase = gTop + Math.min(groundHeight * 0.2, 34);
        ctx.save();
        ctx.globalAlpha = 0.72 + 0.22 * dayAmount;
        ctx.fillStyle = dayAmount > 0.45 ? "rgba(29,41,24,0.86)" : "rgba(2,5,4,0.82)";
        ctx.beginPath();
        ctx.moveTo(0, H);
        ctx.lineTo(0, ridgeBase);
        for (let x = 0; x <= W + 24; x += 16) {
          const y = ridgeBase
            - 10
            - Math.sin(x * 0.035) * 8
            - Math.sin(x * 0.11) * 4;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.58 + 0.24 * dayAmount;
        for (let i = 0; i < 64; i++) {
          const baseX = (i * 53 + (i % 5) * 11) % (W + 80) - 40;
          const baseY = ridgeBase - 8 - Math.sin(i * 1.4) * 7;
          const radius = 12 + (i * 11) % 26;
          const shrub = ctx.createRadialGradient(baseX, baseY, 2, baseX, baseY, radius);
          shrub.addColorStop(0, dayAmount > 0.45 ? "rgba(57,74,36,0.88)" : "rgba(6,12,8,0.86)");
          shrub.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = shrub;
          ctx.beginPath();
          ctx.ellipse(baseX, baseY, radius * 1.25, radius * 0.72, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.30 + 0.32 * dayAmount;
        for (let i = 0; i < 78; i++) {
          const cxPatch = (i * 61) % (W + 100) - 50;
          const cyPatch = gTop + groundHeight * (0.34 + ((i * 17) % 50) / 100);
          const rw = 18 + (i * 13) % 42;
          const rh = 5 + (i * 7) % 18;
          const patch = ctx.createRadialGradient(cxPatch, cyPatch, 2, cxPatch, cyPatch, rw);
          patch.addColorStop(0, dayAmount > 0.45 ? "rgba(104,117,58,0.36)" : "rgba(17,24,15,0.34)");
          patch.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = patch;
          ctx.beginPath();
          ctx.ellipse(cxPatch, cyPatch, rw, rh, Math.sin(i) * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.50 + 0.34 * dayAmount;
        for (let i = 0; i < 260; i++) {
          const x = (i * 29) % (W + 40) - 20;
          const root = gTop + 18 + ((i * 13) % Math.max(24, groundHeight * 0.3));
          const height = 14 + ((i * 17) % 42);
          const bend = Math.sin(i * 1.7) * 10;
          ctx.strokeStyle = dayAmount > 0.45
            ? i % 3 === 0 ? "rgba(148,140,75,0.72)" : "rgba(72,86,45,0.68)"
            : i % 3 === 0 ? "rgba(42,39,24,0.64)" : "rgba(8,13,9,0.70)";
          ctx.lineWidth = 0.65 + (i % 4) * 0.18;
          ctx.beginPath();
          ctx.moveTo(x, root);
          ctx.quadraticCurveTo(x + bend * 0.45, root - height * 0.55, x + bend, root - height);
          ctx.stroke();
        }
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.48 + 0.40 * dayAmount;
        for (let i = 0; i < 320; i++) {
          const x = (i * 37) % (W + 60) - 30;
          const base = H - ((i * 19) % Math.max(18, groundHeight * 0.14));
          const height = 26 + ((i * 23) % 78);
          const tilt = Math.sin(i * 2.1) * 18;
          ctx.strokeStyle = dayAmount > 0.45
            ? i % 4 === 0 ? "rgba(190,169,91,0.74)" : i % 4 === 1 ? "rgba(91,105,53,0.76)" : "rgba(56,73,42,0.72)"
            : i % 4 === 0 ? "rgba(72,65,39,0.70)" : "rgba(20,29,18,0.78)";
          ctx.lineWidth = 0.9 + (i % 5) * 0.22;
          ctx.beginPath();
          ctx.moveTo(x, base);
          ctx.quadraticCurveTo(x + tilt * 0.28, base - height * 0.58, x + tilt, base - height);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 天光散射 — 偏重高空，近地平线收敛
      const scTop = H * 0.04;
      const scBot = Math.min(H, hY);
      const scatter = ctx.createLinearGradient(0, scTop, 0, scBot);
      scatter.addColorStop(0, "transparent");
      scatter.addColorStop(0.25, "rgba(20,16,10,0.05)");
      scatter.addColorStop(0.55, "rgba(20,16,10,0.015)");
      scatter.addColorStop(1, "transparent");
      ctx.fillStyle = scatter;
      ctx.fillRect(0, 0, W, scBot);
      ctx.restore();
    }
    dimsRef.current.hitObjects = hitObjects;

    if (arMode && onAimTargetChange) {
      const centerX = W / 2;
      const centerY = H / 2;
      const captureRadius = Math.max(28, Math.min(40, Math.min(W, H) * 0.06));
      const releaseRadius = captureRadius + 12;
      const focusedMembers = activeFocusedConstellation?.memberSlugs ?? null;
      const brightStarHits = hitObjects.filter((hit) =>
        hit.type === "bright_star" && (!focusedMembers || focusedMembers.includes(hit.slug)),
      );
      const distanceToCenter = (hit: HitObject) => Math.hypot(hit.x - centerX, hit.y - centerY);
      const candidateRadius = Math.max(72, Math.min(112, Math.min(W, H) * 0.16));
      const nearbyHits = brightStarHits
        .map((hit) => ({ hit, distance: distanceToCenter(hit) }))
        .filter(({ distance }) => distance <= candidateRadius)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 4)
        .map(({ hit }) => hit);
      const nearbyTargets = nearbyHits.map((hit) => ({
        name: hit.name,
        type: hit.type,
        slug: hit.slug,
      }));
      const nearbyKey = nearbyTargets.map((hit) => hit.slug).join(",");
      const previous = brightStarHits.find((hit) => hit.slug === lastAimSlugRef.current);
      let aimed = previous && distanceToCenter(previous) <= releaseRadius ? previous : null;

      if (!aimed) {
        const nearest = brightStarHits.reduce<HitObject | null>((best, hit) => {
          if (!best) return hit;
          return distanceToCenter(hit) < distanceToCenter(best) ? hit : best;
        }, null);
        if (nearest && distanceToCenter(nearest) <= captureRadius) aimed = nearest;
      }

      const nextSlug = aimed?.slug ?? null;
      if (nextSlug !== lastAimSlugRef.current || nearbyKey !== lastAimNearbyKeyRef.current) {
        lastAimSlugRef.current = nextSlug;
        lastAimNearbyKeyRef.current = nearbyKey;
        onAimTargetChange(aimed
          ? { name: aimed.name, type: aimed.type, slug: aimed.slug }
          : null, nearbyTargets);
      }
    } else if (lastAimSlugRef.current !== null || lastAimNearbyKeyRef.current !== "") {
      lastAimSlugRef.current = null;
      lastAimNearbyKeyRef.current = "";
      onAimTargetChange?.(null, []);
    }
  }, [target, source, selected, obsTime, obsLocation, is2DMode, orientation, orionBestWindow, manualViewOffset, arMode, onAimTargetChange]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (dragRef.current.suppressClick) return;
      const canvas = ref.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const nx = px / rect.width;
      const ny = py / rect.height;
      const n2p = dimsRef.current.nameToPos;

      const hit = closestHitObject(dimsRef.current.hitObjects, px, py);
      if (hit) {
        onObjectClick({
          name: hit.name,
          type: hit.type,
          slug: hit.slug,
          isPreviewOnly: hit.isPreviewOnly,
        });
        return;
      }

      if (!is2DMode) return;

      // 遍历所有可点击对象（核心 + 扩展亮星），统一命中判定
      const n2a = dimsRef.current.nameToAlpha;
      let closestMetaHit: HitObject | null = null;
      let closestMetaDistance = Number.POSITIVE_INFINITY;
      for (const [name, meta] of Object.entries(objectMeta)) {
        if ((n2a.get(name) ?? 1) < 0.05) continue;
        const pos = n2p.get(name);
        if (!pos) continue;
        if (!is2DMode && pos.y > dimsRef.current.hY) continue;
        const sx = pos.x / rect.width;
        const sy = pos.y / rect.height;
        const starR = stars.find((s) => s.name === name)?.r ?? 0.6;
        const isTargetStar = !!(target && name === slugToStarName[target]);
        const hitScale = !is2DMode ? (isTargetStar ? 2.0 : 1.5) : 1;
        const hitR = Math.max(starR * 3 * hitScale, 20 * hitScale) / Math.max(rect.width, 1);
        const dx = sx - nx;
        const dy = sy - ny;
        const distance = Math.hypot(dx, dy);
        if (distance < hitR && distance < closestMetaDistance) {
          closestMetaDistance = distance;
          closestMetaHit = {
            name,
            type: meta.type,
            slug: meta.slug,
            x: sx,
            y: sy,
            r: hitR,
          };
        }
      }

      if (closestMetaHit) {
        onObjectClick({ name: closestMetaHit.name, type: closestMetaHit.type, slug: closestMetaHit.slug });
      }

    },
    [onObjectClick, is2DMode, target],
  );

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (arMode) return;
    dragRef.current.active = true;
    dragRef.current.moved = false;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [arMode]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (arMode || !dragRef.current.active) return;
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    if (Math.abs(dx) + Math.abs(dy) < 1) return;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragRef.current.moved = true;
    setManualViewOffset((prev) => {
      const twoDFov = rect.width <= 640 ? 150 : 210;
      const azDelta = -(dx / Math.max(1, rect.width)) * (is2DMode ? twoDFov : 125);
      const altDelta = (dy / Math.max(1, rect.height)) * 70;
      return {
        az: ((prev.az + azDelta + 540) % 360) - 180,
        alt: is2DMode ? prev.alt : Math.max(-65, Math.min(65, prev.alt + altDelta)),
      };
    });
    e.preventDefault();
  }, [arMode, is2DMode]);

  const finishPointerDrag = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    if (dragRef.current.moved) {
      dragRef.current.suppressClick = true;
      window.setTimeout(() => {
        dragRef.current.suppressClick = false;
      }, 120);
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 z-10 h-full w-full cursor-crosshair pointer-events-auto"
      style={{ background: arMode ? "transparent" : "#070b0c", touchAction: "none" }}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerDrag}
      onPointerCancel={finishPointerDrag}
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

function drawNamedLine(
  ctx: CanvasRenderingContext2D,
  nameToPos: Map<string, { x: number; y: number }>,
  nameToAlpha: Map<string, number>,
  a: string,
  b: string,
  isInSkyArea: (screenY: number) => boolean,
) {
  const pa = nameToPos.get(a);
  const pb = nameToPos.get(b);
  if (!pa || !pb) return;
  if (!isInSkyArea(pa.y) || !isInSkyArea(pb.y)) return;
  const aa = nameToAlpha.get(a) ?? 0;
  const ab = nameToAlpha.get(b) ?? 0;
  if (aa < 0.05 || ab < 0.05) return;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, 0.35 + Math.min(aa, ab));
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.stroke();
  ctx.restore();
}
