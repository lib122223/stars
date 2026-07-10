"use client";

import { useEffect, useRef } from "react";

/**
 * WWT 最小复现诊断页
 * 临时路由：/wwt-minimal
 * 仅用于判断 WWT 原生可见渲染是项目集成问题还是包/资源/网络问题
 */
export default function WWTMinimalPage() {
  const ref = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    async function boot() {
      const { WWTInstance } = await import("@wwtelescope/engine-helpers");

      if (!ref.current) return;
      ref.current.id = "wwt-minimal-container";

      const wwt = new WWTInstance({
        elId: "wwt-minimal-container",
        startInternalRenderLoop: true,
        startLatDeg: 30,
        startLngDeg: 180,
        startZoomDeg: 60,
      });

      await wwt.waitForReady();

      const s = wwt.si.settings;
      s.set_showConstellationFigures?.(true);
      s.set_showConstellationLabels?.(true);
    }

    boot();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000",
        margin: 0,
        padding: 0,
      }}
    />
  );
}
