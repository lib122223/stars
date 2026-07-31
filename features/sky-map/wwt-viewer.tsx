"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { lookupByCoord } from "./object-lookup";
import type { AstronomyCatalog } from "@/lib/astronomy/catalog-types";

interface CelestialClick {
  name: string;
  type: string;
  slug: string;
}

interface WWTViewerProps {
  onObjectClick: (obj: CelestialClick) => void;
  time: Date;
  location: { lat: number; lng: number };
  onReady?: (info: { time: string; location: string }) => void;
  target: string | null;
  catalog?: AstronomyCatalog;
}

/** target slug → RA(hours) / Dec(degrees) / zoom(degrees) */
const targetCoords: Record<
  string,
  { raHours: number; decDeg: number; zoomDeg: number }
> = {
  jupiter: { raHours: 8.8, decDeg: 18, zoomDeg: 20 },
  moon: { raHours: 12, decDeg: -5, zoomDeg: 10 },
  vega: { raHours: 18.6156, decDeg: 38.7837, zoomDeg: 30 },
  "brightest-visible-target": {
    raHours: 18,
    decDeg: 30,
    zoomDeg: 60,
  },
  "bright-star-entry": { raHours: 6, decDeg: -16, zoomDeg: 60 },
};

const defaultCoords = { raHours: 12, decDeg: 30, zoomDeg: 60 };

interface WWTHandle {
  si: {
    settings: Record<string, (v?: unknown) => unknown>;
    getRA: () => number;
    getDec: () => number;
  };
  stc: { set_now: (d: Date) => Date; get_now: () => Date };
  waitForReady: () => Promise<void>;
  gotoRADecZoom: (
    raRad: number,
    decRad: number,
    zoomDeg: number,
    instant: boolean,
  ) => Promise<void>;
}

export default function WWTViewer({
  onObjectClick,
  time,
  location,
  onReady,
  target,
  catalog,
}: WWTViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wwtRef = useRef<WWTHandle | null>(null);
  const startedRef = useRef(false);
  const targetRef = useRef(target);
  const [, setTick] = useState(0);

  // 始终保持 ref 与最新 target prop 同步
  targetRef.current = target;

  function navigateTo(t: string) {
    const wwt = wwtRef.current;
    if (!wwt) return false;
    const c = targetCoords[t] ?? defaultCoords;
    const raRad = (c.raHours * 15 * Math.PI) / 180;
    const decRad = (c.decDeg * Math.PI) / 180;
    wwt.gotoRADecZoom(raRad, decRad, c.zoomDeg, false);
    return true;
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    async function boot() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let wwt: any = null;

      try {
        const { WWTInstance } = await import("@wwtelescope/engine-helpers");

        if (!containerRef.current) return;

        const el = containerRef.current;
        el.id = el.id || `wwt-${Math.random().toString(36).slice(2, 8)}`;

        // TODO(wwt): 当前缺少 startInternalRenderLoop: true，WWT 不触发巡天图请求。
        // /wwt-minimal 已证明加上该参数后会触发 WWT 巡天资源请求（131 条）。
        // 但 headless/SwiftShader 下 WebGL context lost，仍无法验证可见渲染。
        // 在真实浏览器手动验证可见之前，WWT 不恢复为 /sky-map 主视觉层。
        // StarCanvas 继续作为 V2 主舞台。
        // 证据：evidence/wwt-minimal.png
        wwt = new WWTInstance({
          elId: el.id,
          startLatDeg: 39.9,
          startLngDeg: 116.4,
          startZoomDeg: 60,
        });
        await wwt.waitForReady();
      } catch (err) {
        console.error("WWT boot failed:", err);
        return;
      }

      if (!wwt) return;

      const h = wwt as unknown as WWTHandle;
      wwtRef.current = h;

      const s = h.si.settings;
      s.set_showConstellationFigures?.(true);
      s.set_showConstellationLabels?.(true);
      s.set_showConstellationPictures?.(true);
      s.set_showConstellationBoundries?.(false);
      s.set_showCrosshairs?.(false);
      s.set_showGrid?.(false);
      s.set_showHorizon?.(true);
      s.set_showEarthSky?.(false);
      s.set_showElevationModel?.(false);
      s.set_localHorizonMode?.(false);
      s.set_showSolarSystem?.(true);
      s.set_solarSystemStars?.(true);
      s.set_solarSystemPlanets?.(true);
      s.set_milkyWayModel?.(true);

      h.stc.set_now(time);
      s.set_locationLat?.(location.lat);
      s.set_locationLng?.(location.lng);

      // ready 后执行首航 — 通过 ref 拿最新 target，不依赖闭包中的旧值
      if (targetRef.current) {
        navigateTo(targetRef.current);
      }

      const appliedTime = h.stc.get_now();
      const appliedLat = s.get_locationLat?.() as number | undefined;
      const appliedLng = s.get_locationLng?.() as number | undefined;

      onReady?.({
        time: appliedTime.toISOString(),
        location:
          appliedLat != null && appliedLng != null
            ? `${appliedLat.toFixed(2)}°N, ${appliedLng.toFixed(2)}°E`
            : "unknown",
      });

      setTick(1);
    }

    boot();

    return () => {
      wwtRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    wwtRef.current?.stc?.set_now?.(time);
  }, [time]);

  useEffect(() => {
    const s = wwtRef.current?.si?.settings;
    if (s) {
      s.set_locationLat?.(location.lat);
      s.set_locationLng?.(location.lng);
    }
  }, [location]);

  // target 后续变化 → 再次导航（首航已由 boot 中 targetRef 处理）
  const prevTargetRef = useRef(target);
  useEffect(() => {
    const prev = prevTargetRef.current;
    prevTargetRef.current = target;

    if (target === prev) return; // 跳过首航（boot 已处理）
    if (!target) return;

    navigateTo(target);
  }, [target]);

  /** 调用 resolve API，尝试获取服务端权威对象 */
  async function resolveByName(
    name: string,
    objType: string,
  ): Promise<CelestialClick | null> {
    try {
      const params = new URLSearchParams({ name });
      if (objType) params.set("type", objType);
      const res = await fetch(`/api/sky-map/resolve?${params.toString()}`);
      const json = await res.json();
      if (json.code === 0 && json.data?.matched) {
        const o = json.data.object;
        return { name: o.nameZh, type: o.objectType, slug: o.slug };
      }
    } catch {
      /* resolve 不可用时回退 */
    }
    return null;
  }

  /** 点击 → pixel→RA/Dec → 识别候选名 → resolve → 回退 */
  const handleCanvasClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      const wwt = wwtRef.current;
      const el = containerRef.current;
      if (!wwt || !el) return;

      const viewRA = wwt.si.getRA();
      const viewDec = wwt.si.getDec();
      const fovDeg =
        (wwt.si.settings.get_fovCamera?.() as number) ?? 60;

      const rect = el.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = (e.clientX - rect.left - cx) / cx;
      const dy = (e.clientY - rect.top - cy) / cy;

      const decRad = (viewDec * Math.PI) / 180;
      const clickRA = viewRA - (dx * fovDeg) / (30 * Math.cos(decRad));
      const clickDec = viewDec + (dy * fovDeg) / 2;

      // 1. 客户端识别 → 产生候选名
      let candidateName = "";
      let candidateType = "";

      try {
        const { Constellations } = await import("@wwtelescope/engine");
        // @ts-expect-error — @wwtelescope/engine 类型定义与运行时导出不一致（PoC 废弃代码）
        const constellation = Constellations.findConstellationForPoint(
          clickRA,
          clickDec,
        );
        if (constellation) {
          candidateName = constellation;
          candidateType = "constellation";
        }
      } catch {
        /* continue */
      }

      if (!candidateName) {
        const result = lookupByCoord(clickRA, clickDec, catalog?.brightStars);
        if (result) {
          candidateName = result.nameEn;
          candidateType = result.type;
        }
      }

      // 2. 调用 resolve 获取服务端权威对象
      if (candidateName) {
        const resolved = await resolveByName(candidateName, candidateType);
        if (resolved) {
          onObjectClick(resolved);
          return;
        }
      }

      // 3. 回退：resolve 未命中时的客户端对象级回退
      if (candidateName) {
        // 星座：直接保留客户端识别结果，不经过 lookupByCoord
        if (candidateType === "constellation") {
          onObjectClick({
            name: candidateName,
            type: candidateType,
            slug: candidateName.toLowerCase().replace(/\s+/g, "-"),
          });
          return;
        }

        // 亮星/行星：通过 lookupByCoord 获取中文名
        const fallback = lookupByCoord(clickRA, clickDec, catalog?.brightStars);
        if (fallback) {
          onObjectClick({
            name: fallback.nameZh,
            type: fallback.type,
            slug: fallback.nameEn.toLowerCase(),
          });
          return;
        }
      }

      // 4. 最终兜底：坐标
      onObjectClick({
        name: `RA ${clickRA.toFixed(1)}h Dec ${clickDec >= 0 ? "+" : ""}${clickDec.toFixed(1)}°`,
        type: "coord",
        slug: `coord-${clickRA.toFixed(3)}-${clickDec.toFixed(3)}`
          .replace(/\./g, "-")
          .replace(/\s/g, ""),
      });
    },
    [onObjectClick, catalog],
  );

  return (
    <div
      ref={containerRef}
      className="h-full w-full pointer-events-none"
      onClick={handleCanvasClick}
      style={{ cursor: "crosshair" }}
    />
  );
}
