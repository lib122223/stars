"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import LoadingCard from "@/features/home/loading-card";
import ErrorCard from "@/features/home/error-card";

// ---- 数据契约（沿用现有 /api/recommendations 返回结构，只取本轮需要的字段） ----

interface HomeData {
  primaryRecommendation: {
    title: string;
    reason: string;
    targetRef: string;
  };
  conditionSummary: { basis: string; actionHint: string };
}

type GeoState = "pending" | "granted" | "denied" | "unavailable";

type PageState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; data: HomeData };

// ---- 页面 ----

export default function HomePage() {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [geoState, setGeoState] = useState<GeoState>("pending");
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);

  //  浏览器定位
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoState("unavailable");
      return;
    }
    const t = setTimeout(() => setGeoState("denied"), 8000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(t);
        coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGeoState("granted");
      },
      () => { clearTimeout(t); setGeoState("denied"); },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 },
    );
    return () => clearTimeout(t);
  }, []);

  //  拉取推荐
  const fetchData = useCallback(() => {
    setState({ status: "loading" });
    const p = new URLSearchParams();
    const c = coordsRef.current;
    if (c) { p.set("lat", c.lat.toFixed(4)); p.set("lng", c.lng.toFixed(4)); }
    const qs = p.toString();
    fetch(`/api/recommendations${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.code === 0 && j.data) setState({ status: "ok", data: j.data });
        else setState({ status: "error" });
      })
      .catch(() => setState({ status: "error" }));
  }, []);

  useEffect(() => { if (geoState !== "pending") fetchData(); }, [fetchData, geoState]);

  // ---- 渲染 ----

  if (state.status === "loading") {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-lg flex-col justify-center px-4 py-12">
        <LoadingCard />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-lg flex-col justify-center px-4 py-12">
        <ErrorCard onRetry={fetchData} />
      </div>
    );
  }

  const d = state.data;
  const recTarget = d.primaryRecommendation.targetRef;
  const skymapUrl = recTarget
    ? `/sky-map?target=${recTarget}&source=primary`
    : "/sky-map";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-lg flex-col justify-center px-4 py-6">

      {/*  1. 开始看一下 — 最强主入口 */}
      <Link
        href={skymapUrl}
        className="flex flex-col items-center rounded-2xl bg-accent/15 px-8 py-7 text-center transition-colors hover:bg-accent/20"
      >
        <span className="text-lg font-semibold tracking-tight text-accent">
          开始看一下
        </span>

        {/* 推荐理由 — 附属，明显弱于入口本身 */}
        {recTarget && (
          <span className="mt-2 text-xs text-accent/35 leading-relaxed">
            {d.primaryRecommendation.reason}
          </span>
        )}

        {/* 客观条件 + 行动建议 — 轻信息束 */}
        <span className={`${recTarget ? "mt-2" : "mt-3"} text-[9px] text-white/08 leading-relaxed`}>
          {d.conditionSummary.basis && (
            <>{d.conditionSummary.basis} · </>
          )}
          {d.conditionSummary.actionHint}
        </span>

        {geoState === "granted" && (
          <span className="mt-2 text-[9px] text-white/06">
            · 已获取位置 ·
          </span>
        )}
      </Link>

      {/* 2 / 3. 第二层 */}
      <div className="flex gap-3 mt-4">
        <Link
          href="/sky-map"
          className="flex-1 rounded-xl bg-surface/40 px-5 py-3 text-center text-sm text-white/45 transition-colors hover:bg-surface/60 hover:text-white/70"
        >
          看 2D 星图
        </Link>
        <Link
          href="/tools"
          className="flex-1 rounded-xl bg-surface/40 px-5 py-3 text-center text-sm text-white/45 transition-colors hover:bg-surface/60 hover:text-white/70"
        >
          查看观测条件
        </Link>
      </div>

      {/*  4. 换一个目标 — 未来入口占位 */}
      <div className="flex justify-center mt-3">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/5 px-4 py-1.5 text-xs text-white/12 select-none opacity-60">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="23,4 23,10 17,10" />
            <path d="M20.5 15a9 9 0 1 1-2.6-6.3L23 10" />
          </svg>
          换一个目标
        </span>
      </div>

    </div>
  );
}
