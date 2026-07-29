"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import ObservationPanel from "@/features/tools/observation-panel";
import HourlyForecast from "@/features/tools/hourly-forecast";
import SiteConditionMap from "@/features/tools/site-condition-map";
import SatellitePassPanel from "@/features/tools/satellite-pass-panel";

interface ToolsData {
  verdict: { suitable: boolean; summary: string };
  moon?: { phaseFraction: number; rise: string | null; set: string | null };
  sun?: { rise: string | null; set: string | null };
  cloud?: { cover: number } | null;
  clarity?: { level: string } | null;
  nearby?: { recommended: boolean; summary: string };
  hourlyForecast?: {
    time: string;
    cloudCover: number;
    clarityLevel: string;
    visibility: number;
    humidity: number;
    windSpeed: number;
    precipitationProbability: number;
  }[];
}

interface UpcomingEvent {
  slug: string;
  nameZh: string;
  peakDate: string;
  zhr: number;
}

type PageState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; data: ToolsData };

type LocationState =
  | { status: "pending" }
  | { status: "granted"; lat: number; lng: number }
  | { status: "denied" };

export default function ToolsPage() {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [location, setLocation] = useState<LocationState>({ status: "pending" });

  const fetchData = useCallback((loc: LocationState) => {
    setState({ status: "loading" });

    const params = new URLSearchParams();
    if (loc.status === "granted") {
      params.set("lat", String(loc.lat));
      params.set("lng", String(loc.lng));
    }
    const qs = params.toString();
    const url = `/api/tools/observation-summary${qs ? `?${qs}` : ""}`;

    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        if (json.code === 0 && json.data) {
          setState({ status: "ok", data: json.data as ToolsData });
        } else {
          setState({ status: "error" });
        }
      })
      .catch(() => {
        setState({ status: "error" });
      });
  }, []);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocation({ status: "denied" });
      return;
    }
    setLocation({ status: "pending" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ status: "granted", lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocation({ status: "denied" });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(requestLocation, 0);
    return () => window.clearTimeout(timer);
  }, [requestLocation]);

  useEffect(() => {
    // 等待定位结果后再请求观测数据
    if (location.status === "pending") return;
    const timer = window.setTimeout(() => fetchData(location), 0);
    return () => window.clearTimeout(timer);
  }, [location, fetchData]);

  useEffect(() => {
    // 天象仅首屏加载一次
    fetch("/api/tools/upcoming-events")
      .then((r) => r.json())
      .then((json) => {
        if (json.code === 0 && json.data?.events) {
          setEvents(json.data.events.slice(0, 3));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col px-4 py-10">
      <div className="text-center">
        <p className="text-accent/40 text-xs tracking-wider uppercase">
          观测工具
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">
          今晚观测条件
        </h1>
      </div>

      {/* 位置来源提示 */}
      <p className="mt-3 text-center text-[10px] text-white/15">
        {location.status === "pending"
          ? "正在获取位置..."
          : location.status === "granted"
          ? "已使用当前位置"
          : "未获取定位，使用默认位置估算"}
      </p>

      <section className="mt-5 rounded-xl border border-white/5 bg-surface/45 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-accent/35">3D 天体地貌地图</p>
            <p className="mt-1 text-sm font-medium text-white/70">
              查看月球、火星、水星的山脉、盆地、峡谷与陨石坑
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-[28rem] sm:grid-cols-5">
            <Link
              href="/tools/body-map/moon"
              className="rounded-md bg-white/[0.06] px-3 py-2 text-center text-xs text-white/45 transition-colors hover:bg-white/[0.10] hover:text-white/70"
            >
              月球
            </Link>
            <Link
              href="/tools/body-map/mars"
              className="rounded-md bg-white/[0.06] px-3 py-2 text-center text-xs text-white/45 transition-colors hover:bg-white/[0.10] hover:text-white/70"
            >
              火星
            </Link>
            <Link
              href="/tools/body-map/mercury"
              className="rounded-md bg-white/[0.06] px-3 py-2 text-center text-xs text-white/45 transition-colors hover:bg-white/[0.10] hover:text-white/70"
            >
              水星
            </Link>
            <Link
              href="/tools/lunar-rover"
              className="rounded-md border border-accent/20 bg-accent/12 px-3 py-2 text-center text-xs text-accent transition-colors hover:bg-accent/18"
            >
              月球车
            </Link>
            <Link
              href="/tools/device-simulator"
              className="rounded-md bg-white/[0.06] px-3 py-2 text-center text-xs text-white/45 transition-colors hover:bg-white/[0.10] hover:text-white/70"
            >
              设备模拟
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        {state.status === "loading" && (
          <div className="space-y-5 rounded-xl bg-surface/60 p-6 sm:p-8">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="h-3 w-12 rounded-sm bg-white/[0.06] animate-pulse mb-2" />
                <div className="h-4 w-full rounded-sm bg-white/[0.04] animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {state.status === "error" && (
          <div className="rounded-xl bg-surface/60 p-6 sm:p-8 text-center">
            <p className="text-sm text-white/30">观测数据暂时无法加载</p>
            <button
              onClick={requestLocation}
              className="mt-3 rounded-lg bg-white/[0.06] px-4 py-1.5 text-xs text-white/35"
            >
              重试
            </button>
          </div>
        )}

        {state.status === "ok" && (
          <ObservationPanel
            verdict={state.data.verdict}
            moon={state.data.moon}
            sun={state.data.sun}
            cloud={state.data.cloud}
            clarity={state.data.clarity}
            nearby={state.data.nearby}
            events={events}
          />
        )}

        <SiteConditionMap
          key={
            location.status === "granted"
              ? `${location.lat.toFixed(5)}:${location.lng.toFixed(5)}`
              : "default"
          }
          currentLocation={
            location.status === "granted"
              ? { lat: location.lat, lng: location.lng }
              : { lat: 39.9, lng: 116.4 }
          }
          locationLabel={
            location.status === "granted"
              ? "地图中心：当前位置附近"
              : "地图中心：默认位置，可点选任意区域"
          }
        />
      </div>

      {state.status === "ok" && state.data.hourlyForecast && state.data.hourlyForecast.length > 0 && (
        <div className="mt-5">
          <HourlyForecast data={state.data.hourlyForecast} />
        </div>
      )}

      <SatellitePassPanel
        location={location.status === "granted" ? { lat: location.lat, lng: location.lng } : null}
        locationStatus={location.status}
        onRequestLocation={requestLocation}
      />

      <div className="mt-8 flex justify-center">
        <Link
          href="/"
          className="inline-flex items-center rounded-lg bg-white/[0.06] px-4 py-2 text-xs text-white/35 transition-colors hover:bg-white/[0.10] hover:text-white/55"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
