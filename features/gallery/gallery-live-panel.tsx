"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface SkyCondition {
  score: number;
  bestTime: string | null;
  direction: string;
  azimuth: number | null;
  altitude: number | null;
  summary: string;
}

interface VisibleSkyObject {
  slug: string;
  name: string;
  type: "bright_star" | "planet" | "moon";
  altitude: number;
  direction: string;
  visibilityLabel: string;
}

interface LiveEvent {
  slug: string;
  nameZh: string;
  peakDate: string;
  visibility: {
    band: "excellent" | "good" | "marginal" | "not_visible";
    score: number;
    activeNow: boolean;
    direction: string;
    radiantAltitude: number | null;
    summary: string;
  };
}

interface IssPass {
  peak: { time: string; direction: string };
  visibility: { label: string };
}

type LocationState =
  | { status: "loading" }
  | { status: "granted"; lat: number; lng: number }
  | { status: "denied" };

function formatTime(value: string | null): string {
  if (!value) return "等待时间计算";
  const trimmed = value.trim();
  if (/^\d{1,2}:\d{2}/.test(trimmed)) return trimmed.slice(0, 5);
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return "时间待定";
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function eventTone(band: LiveEvent["visibility"]["band"]): string {
  if (band === "excellent") return "text-emerald-200/80";
  if (band === "good") return "text-accent/85";
  if (band === "marginal") return "text-amber-100/75";
  return "text-white/35";
}

function positionText(condition: SkyCondition): string {
  if (condition.azimuth == null || condition.altitude == null) return condition.direction;
  return `${condition.direction} · 方位 ${Math.round(condition.azimuth)}° · 仰角 ${Math.round(condition.altitude)}°`;
}

export default function GalleryLivePanel({
  location: externalLocation,
  showLive = true,
}: { location?: { lat: number; lng: number } | null; showLive?: boolean } = {}) {
  const [detectedLocation, setDetectedLocation] = useState<LocationState>({ status: "loading" });
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [conditions, setConditions] = useState<{ sunsetGlow: SkyCondition; sunriseGlow: SkyCondition } | null>(null);
  const [visibleObjects, setVisibleObjects] = useState<VisibleSkyObject[]>([]);
  const [iss, setIss] = useState<IssPass | null>(null);

  const location = useMemo<LocationState>(() => {
    if (externalLocation === undefined) return detectedLocation;
    return externalLocation
      ? { status: "granted", ...externalLocation }
      : { status: "denied" };
  }, [detectedLocation, externalLocation]);

  useEffect(() => {
    if (externalLocation !== undefined) return;
    if (!navigator.geolocation) {
      const timer = window.setTimeout(() => setDetectedLocation({ status: "denied" }), 0);
      return () => window.clearTimeout(timer);
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setDetectedLocation({ status: "granted", lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setDetectedLocation({ status: "denied" }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, [externalLocation]);

  useEffect(() => {
    if (!showLive) return;
    const params = new URLSearchParams();
    if (location.status === "granted") {
      params.set("lat", String(location.lat));
      params.set("lng", String(location.lng));
    }
    fetch(`/api/tools/upcoming-events?${params.toString()}`)
      .then((response) => response.json())
      .then((json) => {
        if (json.code === 0) setEvents((json.data?.events ?? []).slice(0, 2));
      })
      .catch(() => {});

    if (location.status !== "granted") return;
    const locationQuery = `lat=${location.lat}&lng=${location.lng}`;
    fetch(`/api/tools/site-conditions?${locationQuery}`)
      .then((response) => response.json())
      .then((json) => {
        const day = json.code === 0 ? json.data?.days?.[0] : null;
        if (day) setConditions({ sunsetGlow: day.sunsetGlow, sunriseGlow: day.sunriseGlow });
        if (json.code === 0) setVisibleObjects(json.data?.visibleSky?.recommended ?? []);
      })
      .catch(() => {});
    fetch(`/api/tools/satellite-passes?${locationQuery}`)
      .then((response) => response.json())
      .then((json) => {
        const pass = json.code === 0 ? json.data?.passes?.[0] : null;
        if (pass) setIss(pass);
      })
      .catch(() => {});
  }, [location, showLive]);

  return (
    <section className="mb-8 border-y border-white/[0.08] py-5" aria-labelledby={showLive ? "gallery-live-heading" : "gallery-personal-heading"}>
      {showLive && <>
      <div className="border-b border-white/[0.06] pb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-accent/55">Tonight</p>
            <p className="mt-1 text-xs text-white/55">今夜可以看的星星</p>
            <p className="mt-1 text-[10px] text-white/30">根据当前位置、时间和地平线筛选</p>
          </div>
          <Link href="/sky-map" className="shrink-0 rounded-md bg-white/[0.06] px-2.5 py-1.5 text-[10px] text-white/55 hover:bg-white/[0.1] hover:text-white/80">进入星图</Link>
        </div>
        {visibleObjects.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:gap-2">
            {visibleObjects.slice(0, 4).map((object) => (
              <Link key={`${object.type}-${object.slug}`} href={`/sky-map?target=${encodeURIComponent(object.slug)}&source=home`} className="min-w-0 rounded-md bg-white/[0.035] px-2.5 py-2 transition-colors hover:bg-white/[0.06] sm:px-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-[13px] text-white/65 sm:text-sm">{object.name}</span>
                  <span className="shrink-0 text-[10px] text-accent/60">{object.direction}</span>
                </div>
                <p className="mt-1 text-[10px] text-white/28">仰角 {Math.round(object.altitude)}° · {object.visibilityLabel}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 border-y border-white/[0.06] py-3 text-xs text-white/30">获取定位后显示当前可见目标。</p>
        )}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-accent/55">Live sky</p>
          <h2 id="gallery-live-heading" className="mt-1 text-base font-medium text-white/82">今日天空</h2>
        </div>
        <p className="text-[10px] text-white/30">
          {location.status === "granted" ? "已按当前位置更新" : location.status === "loading" ? "正在获取位置" : "未获取定位，部分项目暂不显示"}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {conditions && <LiveCard href="/tools?focus=sunset#sunset-event" title="晚霞" value={formatTime(conditions.sunsetGlow.bestTime)} detail={`${positionText(conditions.sunsetGlow)} · 指数 ${conditions.sunsetGlow.score}`} />}
        {conditions && <LiveCard href="/tools?focus=sunrise#sunrise-event" title="早霞" value={formatTime(conditions.sunriseGlow.bestTime)} detail={`${positionText(conditions.sunriseGlow)} · 指数 ${conditions.sunriseGlow.score}`} />}
        {iss && <SatelliteLiveCard pass={iss} />}
        {events.map((event) => (
          <LiveCard
            key={event.slug}
            title={event.nameZh}
            value={event.visibility.activeNow ? "正在活动" : `峰值 ${new Date(event.peakDate).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}`}
            detail={`${event.visibility.direction} · ${event.visibility.radiantAltitude == null ? "仰角待定" : `仰角 ${Math.round(event.visibility.radiantAltitude)}°`} · ${event.visibility.score}`}
            tone={eventTone(event.visibility.band)}
            href="/events"
          />
        ))}
      </div>

      </>}
    </section>
  );
}

function LiveCard({ href, title, value, detail, tone = "text-white/70" }: { href: string; title: string; value: string; detail: string; tone?: string }) {
  return (
    <Link href={href} className="group block min-w-0 rounded-md border border-white/[0.07] bg-white/[0.025] px-2.5 py-2.5 transition-colors hover:border-white/[0.15] hover:bg-white/[0.05] sm:px-3 sm:py-3">
      <p className="truncate text-[10px] text-white/32">{title}</p>
      <p className={`mt-1 truncate text-[13px] font-medium sm:text-sm ${tone}`}>{value}</p>
      <p className="mt-1 break-words text-[10px] leading-relaxed text-white/35">{detail}</p>
      <p className="mt-1.5 text-[10px] text-white/20 transition-colors group-hover:text-white/45 sm:mt-2">查看详细定位 →</p>
    </Link>
  );
}

function SatelliteLiveCard({ pass }: { pass: IssPass }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="col-span-2 min-w-0 rounded-md border border-white/[0.07] bg-white/[0.025] sm:col-span-2 lg:col-span-1">
      <div className="flex items-start gap-2.5 px-2.5 py-2.5 sm:px-3 sm:py-3">
        <Link href="/tools?focus=iss#satellite-passes" className="group min-w-0 flex-1">
          <p className="truncate text-[10px] text-white/32">ISS 下一次过境</p>
          <p className="mt-1 truncate text-[13px] font-medium text-white/70 sm:text-sm">{formatTime(pass.peak.time)}</p>
          <p className="mt-1 break-words text-[10px] leading-relaxed text-white/35">{pass.peak.direction} · {pass.visibility.label}</p>
        </Link>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="shrink-0 pt-0.5 text-[10px] text-accent/65 transition-colors hover:text-accent"
        >
          {expanded ? "收起" : "详情"}
        </button>
      </div>
      {expanded && (
        <div className="border-t border-white/[0.06] px-2.5 py-2.5 text-[10px] leading-relaxed text-white/35 sm:px-3">
          <p>峰值时间 {formatTime(pass.peak.time)} · 方位 {pass.peak.direction}</p>
          <Link href="/tools?focus=iss#satellite-passes" className="mt-1.5 inline-block text-accent/70 hover:text-accent">打开过境定位 →</Link>
        </div>
      )}
    </div>
  );
}
