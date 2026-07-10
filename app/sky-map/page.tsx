"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import BottomDrawer from "@/features/sky-map/bottom-drawer";
import SearchBar from "@/features/sky-map/search-bar";
import OrientationToggle, { type OrientationStatus } from "@/features/sky-map/orientation-toggle";
import { resolveTimeContext, timeContextLabel, type TimeContextKey } from "@/lib/time-context";
import StarCanvas from "@/features/sky-map/star-canvas";

const WWTViewer = dynamic(
  () => import("@/features/sky-map/wwt-viewer"),
  { ssr: false },
);

interface ObjectContent {
  name: string;
  type: string;
  slug: string;
}

/** target slug → 引导态文案映射 */
const targetGuide: Record<string, { target: string; reason: string }> = {
  jupiter: {
    target: "木星",
    reason: "首页推荐，当前亮度高，位置明显，适合新手先认。",
  },
  moon: {
    target: "月球",
    reason: "首页推荐，今晚最容易观测的目标，新手最好的起点。",
  },
  vega: {
    target: "织女星",
    reason: "首页推荐，夏季大三角中最亮的一颗，容易先抓住一个点。",
  },
  venus: { target: "金星", reason: "当前亮度最高，是夜空中最显眼的天体之一。" },
  mars: { target: "火星", reason: "橙红色光芒，辨识度极高。" },
  saturn: { target: "土星", reason: "淡黄色光芒，适合作为长期跟踪目标。" },
  sirius: { target: "天狼星", reason: "夜空中最亮的恒星。" },
  polaris: { target: "北极星", reason: "几乎不动，是辨认方向的天然锚点。" },
  betelgeuse: { target: "参宿四", reason: "橙红色超巨星，颜色鲜明易辨。" },
  orion: { target: "猎户座", reason: "冬季夜空最易辨认的星座，以腰带三星为标志。" },
  "brightest-visible-target": {
    target: "木星",
    reason: "通用推荐，今晚最明亮的目标，最适合作为观星起点。",
  },
  "bright-star-entry": {
    target: "天狼星",
    reason: "通用推荐，夜空中最亮的恒星，即使城市里也很容易看到。",
  },
};

const defaultGuide = {
  target: "今晚的夜空",
  reason: "真实星图引擎，可按时间地点展示当前可观测的天区。",
};

export default function SkyMapPageWrapper() {
  return (
    <Suspense
      fallback={
        <div
          className="flex flex-col"
          style={{ height: "calc(100vh - 3rem)" }}
        />
      }
    >
      <SkyMapPage />
    </Suspense>
  );
}

function SkyMapPage() {
  const searchParams = useSearchParams();
  const targetParam = searchParams.get("target");
  const rawSource = searchParams.get("source");
  const rawTimeContext = searchParams.get("timeContext");

  // source 归一化：缺失/非法 → "primary"
  const source: "primary" | "secondary" | "related" | "search" =
    rawSource === "secondary" ? "secondary" :
    rawSource === "related" ? "related" :
    rawSource === "search" ? "search" :
    "primary";

  // source-aware 引导文案
  const baseGuide = targetParam
    ? (targetGuide[targetParam] ?? {
        target: targetParam,
        reason: "从首页推荐进入，查看当前可观测位置。",
      })
    : defaultGuide;

  const guide =
    targetParam && source === "secondary"
      ? {
          target: baseGuide.target,
          reason: `也可以看看${baseGuide.target}，${baseGuide.reason.replace(/^首页推荐，/, "").replace(/^通用推荐，/, "")}`,
        }
    : targetParam && source === "related"
      ? {
          target: baseGuide.target,
          reason: `从当前对象继续探索，试试${baseGuide.target}`,
        }
      : baseGuide;

  const [selected, setSelected] = useState<ObjectContent | null>(null);
  const [engineInfo, setEngineInfo] = useState<{
    time: string;
    location: string;
  } | null>(null);

  const displayTimeKey: TimeContextKey = rawTimeContext &&
    (["now", "plus1h", "late"] as string[]).includes(rawTimeContext)
    ? (rawTimeContext as TimeContextKey) : "now";
  const obsTime = resolveTimeContext(rawTimeContext);
  const [obsLocation, setObsLocation] = useState({ lat: 39.9, lng: 116.4 });
  const [orientationStatus, setOrientationStatus] = useState<OrientationStatus>("standard");
  const [orientationAz, setOrientationAz] = useState<number | null>(null);
  const [orientationPitch, setOrientationPitch] = useState<number | null>(null);

  /** 请求设备方向权限 */
  const activateOrientation = useCallback(async () => {
    setOrientationStatus("activating");

    // 桌面端 / 不支持 DeviceOrientation
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      setOrientationStatus("unavailable");
      setTimeout(() => setOrientationStatus("standard"), 2000);
      return;
    }

    try {
      // iOS Safari 需要显式调用 requestPermission
      const DOP = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<"granted" | "denied">;
      };

      if (typeof DOP.requestPermission === "function") {
        const result = await DOP.requestPermission();
        if (result === "granted") {
          setOrientationStatus("active");
        } else {
          setOrientationStatus("standard");
        }
      } else {
        // 其他浏览器：直接尝试激活（不阻塞）
        setOrientationStatus("active");
      }
    } catch {
      setOrientationStatus("standard");
    }
  }, []);

  const deactivateOrientation = useCallback(() => {
    setOrientationStatus("standard");
  }, []);

  // 请求定位（静默回退到默认北京）
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setObsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => { /* 静默回退 */ },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 },
    );
  }, []);

  // 朝向模式 active → 监听设备方向
  useEffect(() => {
    if (orientationStatus !== "active") {
      setOrientationAz(null);
      setOrientationPitch(null);
      return;
    }
    function handleOrientation(e: DeviceOrientationEvent) {
      if (e.alpha != null) setOrientationAz((360 - (e.alpha % 360)) % 360);
      if (e.beta != null) setOrientationPitch(Math.max(0, Math.min(90, 90 - e.beta)));
    }
    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [orientationStatus]);

  const handleObjectClick = useCallback(async (obj: ObjectContent) => {
    // 先经 resolve 获取服务端权威对象
    try {
      const params = new URLSearchParams({ name: obj.name });
      if (obj.type) params.set("type", obj.type);
      const res = await fetch(`/api/sky-map/resolve?${params.toString()}`);
      const json = await res.json();
      if (json.code === 0 && json.data?.matched) {
        const o = json.data.object;
        setSelected({ name: o.nameZh, type: o.objectType, slug: o.slug });
        return;
      }
    } catch {
      /* resolve 不可用则回退到客户端数据 */
    }

    setSelected(obj);
  }, []);

  const handleReady = useCallback(
    (info: { time: string; location: string }) => {
      setEngineInfo(info);
    },
    [],
  );

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3rem)" }}>
      {/* 顶部页头 */}
      <div className="absolute top-12 left-0 right-0 z-20 flex items-center justify-between px-4 h-8">
        <span className="text-white/25 text-xs pointer-events-none">
          {timeContextLabel(displayTimeKey)}
          {engineInfo && (
            <span className="ml-1.5 text-white/15">
              · 引擎{" "}
              {new Date(engineInfo.time).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </span>
        <span className="text-white/25 text-xs pointer-events-none mr-2">
          {obsLocation.lat.toFixed(1)}°N
        </span>
        {/* 朝向模式切换 */}
        <OrientationToggle
          status={orientationStatus}
          onActivate={activateOrientation}
          onDeactivate={deactivateOrientation}
        />
        {/* 搜索入口 */}
        <SearchBar timeContext={displayTimeKey} />
      </div>

      {/* 主星图区：自控可见层在上，WWT 引擎隐身在下 */}
      <div className="flex-1 relative">
        <WWTViewer
          onObjectClick={handleObjectClick}
          time={obsTime}
          location={obsLocation}
          onReady={handleReady}
          target={targetParam}
        />
        <StarCanvas
          onObjectClick={handleObjectClick}
          target={targetParam}
          source={source}
          selected={selected}
          obsTime={obsTime}
          obsLocation={obsLocation}
          orientation={orientationAz != null && orientationPitch != null ? { azimuth: orientationAz, pitch: orientationPitch } : undefined}
        />
      </div>

      {/* 底部承接区 — 引导态使用动态 target */}
      <BottomDrawer
        guide={guide}
        selected={selected}
        source={source}
        onSimulateClick={() =>
          setSelected((prev) =>
            prev
              ? null
              : {
                  name: "木星",
                  type: "planet",
                  slug: "jupiter",
                },
          )
        }
      />
    </div>
  );
}
