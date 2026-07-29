"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface SatellitePass {
  start: { time: string; azimuth: number; direction: string };
  peak: { elevation: number };
  end: { time: string };
  durationMinutes: number;
  visibility: { level: "easy" | "possible" | "difficult" };
}

interface SatelliteForecast {
  satellite: { name: string };
  passes: SatellitePass[];
}

interface SatelliteVisibilityAlertProps {
  location: { lat: number; lng: number } | null;
  className?: string;
}

type AlertState =
  | { status: "idle" | "loading" | "error" }
  | { status: "ready"; data: SatelliteForecast; locationKey: string };

function localPassTime(iso: string, now: number): string {
  const date = new Date(iso);
  const today = new Date(now);
  const isToday = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return isToday
    ? `今天 ${time}`
    : `${date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} ${time}`;
}

export default function SatelliteVisibilityAlert({ location, className = "" }: SatelliteVisibilityAlertProps) {
  const [state, setState] = useState<AlertState>({ status: "idle" });
  const [now, setNow] = useState(() => Date.now());
  const locationKey = location ? `${location.lat}:${location.lng}` : null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const requestLocationKey = location ? `${location.lat}:${location.lng}` : null;
    if (!location || !requestLocationKey) {
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      lat: String(location.lat),
      lng: String(location.lng),
    });
    fetch(`/api/tools/satellite-passes?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || json.code !== 0 || !json.data) throw new Error(json.message);
        setState({ status: "ready", data: json.data as SatelliteForecast, locationKey: requestLocationKey });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error" });
      });

    return () => controller.abort();
  }, [location]);

  if (state.status !== "ready" || state.locationKey !== locationKey) return null;

  const pass = state.data.passes.find((candidate) => {
    const end = new Date(candidate.end.time).getTime();
    return end > now && candidate.visibility.level === "easy";
  });
  if (!pass) return null;

  const isInProgress = new Date(pass.start.time).getTime() <= now;

  return (
    <Link
      href="/tools#satellite-passes"
      className={`block rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] p-3 transition-colors hover:bg-emerald-300/[0.11] ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-200/55">观测提醒 · 人造卫星</p>
          <h2 className="mt-1 text-sm font-medium text-emerald-50/90">
            {state.data.satellite.name} {isInProgress ? "正在经过" : "即将经过"}
          </h2>
        </div>
        <span className="shrink-0 rounded-md border border-emerald-200/20 px-2 py-1 text-[10px] text-emerald-100/80">
          容易看见
        </span>
      </div>
      <p className="mt-2 text-xs text-emerald-50/65">
        {localPassTime(pass.start.time, now)} · {pass.start.direction} {Math.round(pass.start.azimuth)}°出现
      </p>
      <p className="mt-1 text-[11px] text-emerald-50/40">
        最高仰角 {Math.round(pass.peak.elevation)}° · 持续约 {pass.durationMinutes} 分钟 · 点击查看完整轨迹
      </p>
    </Link>
  );
}
