"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface MeteorVisibility {
  band: "excellent" | "good" | "marginal" | "not_visible";
  score: number;
  activeNow: boolean;
  daysToPeak: number;
  bestTime: string | null;
  radiantAzimuth: number | null;
  radiantAltitude: number | null;
  direction: string;
  moonIllumination: number | null;
  summary: string;
}

interface MeteorEvent {
  slug: string;
  nameZh: string;
  nameEn: string;
  peakDate: string;
  zhr: number;
  activeStart: string;
  activeEnd: string;
  recommendedTime: string;
  visibility: MeteorVisibility;
}

type LocationState =
  | { status: "loading" }
  | { status: "granted"; lat: number; lng: number }
  | { status: "denied" };

function fmtActive(start: string, end: string): string {
  const [, sm, sd] = start.match(/(?:\d{4}-)?(\d{2})-(\d{2})$/) ?? [];
  const [, em, ed] = end.match(/(?:\d{4}-)?(\d{2})-(\d{2})$/) ?? [];
  return sm && sd && em && ed ? `${Number(sm)}/${Number(sd)} - ${Number(em)}/${Number(ed)}` : `${start} - ${end}`;
}

function visibilityLabel(band: MeteorVisibility["band"]): string {
  if (band === "excellent") return "本地条件较好";
  if (band === "good") return "本地可以尝试";
  if (band === "marginal") return "本地条件一般";
  return "本地不易观测";
}

function visibilityTone(band: MeteorVisibility["band"]): string {
  if (band === "excellent") return "text-emerald-200";
  if (band === "good") return "text-accent";
  if (band === "marginal") return "text-amber-100";
  return "text-white/35";
}

function fmtBestTime(iso: string | null): string {
  if (!iso) return "暂无合适时段";
  return new Date(iso).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EventsPage() {
  const [events, setEvents] = useState<MeteorEvent[] | null>(null);
  const [location, setLocation] = useState<LocationState>({ status: "loading" });

  useEffect(() => {
    if (!navigator.geolocation) {
      const timer = window.setTimeout(() => setLocation({ status: "denied" }), 0);
      return () => window.clearTimeout(timer);
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setLocation({
        status: "granted",
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }),
      () => setLocation({ status: "denied" }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (location.status === "granted") {
      params.set("lat", String(location.lat));
      params.set("lng", String(location.lng));
    }
    fetch(`/api/tools/upcoming-events?${params.toString()}`)
      .then((response) => response.json())
      .then((json) => setEvents(json.code === 0 && json.data?.events ? json.data.events : []))
      .catch(() => setEvents([]));
  }, [location]);

  return (
    <div className="mx-auto min-h-[calc(100vh-3rem)] max-w-2xl px-4 py-12">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wider text-accent/40">天象日历</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">按你的位置看流星雨</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/35">
          同一场流星雨覆盖范围很大，但辐射点高度、当地黑夜和月光会决定你这里是否值得出门。
        </p>
        <p className="mt-3 text-[11px] text-white/25">
          {location.status === "granted"
            ? `已使用当前位置：${location.lat.toFixed(2)}°, ${location.lng.toFixed(2)}°`
            : location.status === "loading"
            ? "正在获取位置，随后更新本地可见程度"
            : "未获取定位，当前使用默认位置估算"}
        </p>
      </div>

      {events === null && <div className="text-sm text-white/25">加载中...</div>}

      {events !== null && events.length === 0 && (
        <div className="rounded-xl bg-surface/60 p-8 text-center text-sm text-white/25">暂无近期流星雨数据</div>
      )}

      {events !== null && events.length > 0 && (
        <div className="space-y-3">
          {events.map((event) => (
            <article key={event.slug} className="rounded-lg border border-white/[0.08] bg-surface/40 px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-white/80">{event.nameZh}</p>
                  <p className="mt-1 text-xs text-white/25">{event.nameEn}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${visibilityTone(event.visibility.band)}`}>
                    {visibilityLabel(event.visibility.band)}
                  </p>
                  <p className="mt-1 text-[10px] tabular-nums text-white/30">本地指数 {event.visibility.score}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 border-y border-white/[0.06] py-3 text-[11px]">
                <div>
                  <p className="text-white/25">活跃期</p>
                  <p className="mt-1 text-white/55">{fmtActive(event.activeStart, event.activeEnd)}</p>
                </div>
                <div>
                  <p className="text-white/25">峰值理论值</p>
                  <p className="mt-1 text-white/55">ZHR {event.zhr}</p>
                </div>
                <div>
                  <p className="text-white/25">推荐时刻</p>
                  <p className="mt-1 text-white/55">{fmtBestTime(event.visibility.bestTime)}</p>
                </div>
                <div>
                  <p className="text-white/25">辐射点</p>
                  <p className="mt-1 text-white/55">
                    {event.visibility.direction} {event.visibility.radiantAltitude == null ? "" : `${Math.round(event.visibility.radiantAltitude)}°`}
                  </p>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-white/45">{event.visibility.summary}</p>
              {event.visibility.moonIllumination != null && (
                <p className="mt-2 text-[10px] text-white/25">
                  峰值时段月面照明约 {Math.round(event.visibility.moonIllumination * 100)}%，实际还需结合云量和光污染。
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      <div className="mt-8 flex justify-center">
        <Link href="/tools" className="inline-flex rounded-lg bg-white/[0.06] px-4 py-2 text-xs text-white/35 transition-colors hover:bg-white/[0.1] hover:text-white/55">
          返回工具页
        </Link>
      </div>
    </div>
  );
}
