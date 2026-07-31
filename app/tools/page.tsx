"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ObservationPanel from "@/features/tools/observation-panel";
import HourlyForecast from "@/features/tools/hourly-forecast";
import SiteConditionMap from "@/features/tools/site-condition-map";
import SkyEventsTimeline from "@/features/tools/sky-events-timeline";
import type { DaySiteCondition } from "@/lib/site-conditions";

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
  visibility: {
    band: "excellent" | "good" | "marginal" | "not_visible";
    score: number;
    activeNow: boolean;
    direction: string;
    radiantAltitude: number | null;
    summary: string;
  };
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
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-3rem)]" />}>
      <ToolsPageContent />
    </Suspense>
  );
}

function ToolsPageContent() {
  const searchParams = useSearchParams();
  const focus = searchParams.get("focus");
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [siteConditions, setSiteConditions] = useState<{ days: DaySiteCondition[] } | null>(null);
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

    fetch(`/api/tools/observation-summary${qs ? `?${qs}` : ""}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.code === 0 && json.data) setState({ status: "ok", data: json.data as ToolsData });
        else setState({ status: "error" });
      })
      .catch(() => setState({ status: "error" }));
  }, []);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocation({ status: "denied" });
      return;
    }
    setLocation({ status: "pending" });
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ status: "granted", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocation({ status: "denied" }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(requestLocation, 0);
    return () => window.clearTimeout(timer);
  }, [requestLocation]);

  useEffect(() => {
    if (location.status === "pending") return;
    const timer = window.setTimeout(() => fetchData(location), 0);
    return () => window.clearTimeout(timer);
  }, [location, fetchData]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (location.status === "granted") {
      params.set("lat", String(location.lat));
      params.set("lng", String(location.lng));
    }
    fetch(`/api/tools/upcoming-events?${params.toString()}`)
      .then((response) => response.json())
      .then((json) => {
        if (json.code === 0 && json.data?.events) setEvents(json.data.events.slice(0, 3));
      })
      .catch(() => {});
  }, [location]);

  useEffect(() => {
    const scrollToHashTarget = () => {
      const hash = window.location.hash.slice(1);
      const focusTarget = focus === "sunset"
        ? "sunset-event"
        : focus === "sunrise"
          ? "sunrise-event"
          : focus === "iss"
            ? "satellite-passes"
            : hash;
      if (!focusTarget) return;

      let attempts = 0;
      const findTarget = () => {
        const target = document.getElementById(focusTarget);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        if (attempts < 20) {
          attempts += 1;
          window.setTimeout(findTarget, 100);
        }
      };

      window.setTimeout(findTarget, 0);
    };

    window.addEventListener("hashchange", scrollToHashTarget);
    scrollToHashTarget();
    return () => window.removeEventListener("hashchange", scrollToHashTarget);
  }, [focus, siteConditions]);

  const currentLocation = location.status === "granted"
    ? { lat: location.lat, lng: location.lng }
    : { lat: 39.9, lng: 116.4 };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col px-4 py-10">
      <header className="text-center">
        <p className="text-xs uppercase tracking-wider text-accent/40">观测工具</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">今晚观测条件</h1>
        <p className="mt-3 text-[10px] text-white/25">
          {location.status === "pending"
            ? "正在获取位置..."
            : location.status === "granted"
            ? "已使用当前定位"
            : "未获取定位，使用默认位置估算"}
        </p>
      </header>

      <div className="mt-6 space-y-5">
        {state.status === "loading" && (
          <div className="space-y-5 rounded-xl bg-surface/60 p-6 sm:p-8">
            {[1, 2, 3].map((item) => (
              <div key={item}>
                <div className="mb-2 h-3 w-12 animate-pulse rounded-sm bg-white/[0.06]" />
                <div className="h-4 w-full animate-pulse rounded-sm bg-white/[0.04]" />
              </div>
            ))}
          </div>
        )}

        {state.status === "error" && (
          <div className="rounded-xl bg-surface/60 p-6 text-center sm:p-8">
            <p className="text-sm text-white/35">观测数据暂时无法加载</p>
            <button
              type="button"
              onClick={() => fetchData(location)}
              className="mt-3 rounded-lg bg-white/[0.06] px-4 py-1.5 text-xs text-white/45 transition-colors hover:bg-white/[0.1]"
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
          key={location.status === "granted" ? `${location.lat.toFixed(5)}:${location.lng.toFixed(5)}` : "default"}
          currentLocation={currentLocation}
          locationLabel={location.status === "granted" ? "地图中心：当前定位附近" : "地图中心：默认位置，可点击选择区域"}
          onDataChange={setSiteConditions}
        />

        {siteConditions && (
          <SkyEventsTimeline
            days={siteConditions.days}
            location={location.status === "granted" ? currentLocation : null}
            locationStatus={location.status}
            onRequestLocation={requestLocation}
          />
        )}

        {state.status === "ok" && state.data.hourlyForecast && state.data.hourlyForecast.length > 0 && (
          <details className="rounded-xl border-y border-white/[0.08] py-4 group">
            <summary className="cursor-pointer list-none text-xs text-white/45 transition-colors hover:text-white/70">
              <span className="mr-2 text-accent/65">+</span>
              展开逐小时天气预报
            </summary>
            <div className="mt-4">
              <HourlyForecast data={state.data.hourlyForecast} />
            </div>
          </details>
        )}

        <section className="border-t border-white/[0.08] pt-6">
          <p className="text-xs uppercase tracking-[0.14em] text-white/30">其他探索工具</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Link href="/tools/body-map/moon" className="rounded-md bg-white/[0.06] px-3 py-2 text-center text-xs text-white/50 transition-colors hover:bg-white/[0.1] hover:text-white/80">月球</Link>
            <Link href="/tools/body-map/mars" className="rounded-md bg-white/[0.06] px-3 py-2 text-center text-xs text-white/50 transition-colors hover:bg-white/[0.1] hover:text-white/80">火星</Link>
            <Link href="/tools/body-map/mercury" className="rounded-md bg-white/[0.06] px-3 py-2 text-center text-xs text-white/50 transition-colors hover:bg-white/[0.1] hover:text-white/80">水星</Link>
            <Link href="/tools/lunar-rover" className="rounded-md border border-accent/20 bg-accent/10 px-3 py-2 text-center text-xs text-accent transition-colors hover:bg-accent/15">月球车</Link>
            <Link href="/tools/device-simulator" className="rounded-md bg-white/[0.06] px-3 py-2 text-center text-xs text-white/50 transition-colors hover:bg-white/[0.1] hover:text-white/80">设备模拟器</Link>
          </div>
        </section>
      </div>

      <div className="mt-8 flex justify-center">
        <Link href="/" className="inline-flex rounded-lg bg-white/[0.06] px-4 py-2 text-xs text-white/35 transition-colors hover:bg-white/[0.1] hover:text-white/55">
          返回首页
        </Link>
      </div>
    </div>
  );
}
