"use client";

import Link from "next/link";
import SatellitePassPanel from "@/features/tools/satellite-pass-panel";
import type { ConditionScore, DaySiteCondition } from "@/lib/site-conditions";

interface SkyEventsTimelineProps {
  days: DaySiteCondition[];
  location: { lat: number; lng: number } | null;
  locationStatus: "pending" | "granted" | "denied";
  onRequestLocation: () => void;
}

function eventLink(kind: "sunset" | "sunrise" | "stars", condition: ConditionScore): string {
  const params = new URLSearchParams({ mode: "observe", source: "search", event: kind });
  if (kind !== "stars") params.set("target", "sun");
  if (condition.bestTimeIso) params.set("eventTime", condition.bestTimeIso);
  return `/sky-map?${params.toString()}`;
}

function timeText(condition: ConditionScore): string {
  if (!condition.windowStart || !condition.windowEnd) return "暂无时间窗口";
  return `${condition.windowStart} - ${condition.windowEnd}`;
}

function positionText(condition: ConditionScore): string {
  if (condition.azimuth == null || condition.altitude == null) return condition.direction;
  return `${condition.direction} · 方位 ${Math.round(condition.azimuth)}° · 仰角 ${Math.round(condition.altitude)}°`;
}

function scoreTone(score: number): string {
  if (score >= 82) return "text-emerald-200";
  if (score >= 68) return "text-accent";
  if (score >= 50) return "text-amber-100";
  return "text-white/40";
}

function EventCard({
  title,
  eyebrow,
  condition,
  href,
  caution,
  id,
}: {
  title: string;
  eyebrow: string;
  condition: ConditionScore;
  href: string;
  caution?: string;
  id?: string;
}) {
  return (
    <article id={id} className="scroll-mt-20 min-w-0 border-l border-white/10 pl-3 first:border-l-0 first:pl-0 sm:pl-4">
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/30">{eyebrow}</p>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-white/75">{title}</h3>
        <span className={`text-lg font-semibold tabular-nums ${scoreTone(condition.score)}`}>
          {condition.score}
        </span>
      </div>
      <p className="mt-1 text-[10px] text-white/35">{timeText(condition)}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-white/45">{positionText(condition)}</p>
      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/40">{condition.summary}</p>
      {caution && <p className="mt-2 text-[10px] leading-relaxed text-amber-100/45">{caution}</p>}
      <Link
        href={href}
        className="mt-3 inline-flex rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[11px] text-white/55 transition-colors hover:bg-white/[0.1] hover:text-white/80"
      >
        进入观察模式定位
      </Link>
    </article>
  );
}

export default function SkyEventsTimeline({
  days,
  location,
  locationStatus,
  onRequestLocation,
}: SkyEventsTimelineProps) {
  const today = days[0];
  const tomorrow = days[1];

  if (!today) return null;

  return (
    <section id="sky-events" className="mt-5 border-y border-white/[0.08] py-5 sm:py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-accent/45">天空事件时间线</p>
          <h2 className="mt-1 text-base font-medium text-white/80">今天什么时候、朝哪边看</h2>
        </div>
        <p className="text-[10px] text-white/30">方位和仰角按当前选址实时计算</p>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        <EventCard
          id="sunset-event"
          title="晚霞"
          eyebrow={today.label}
          condition={today.sunsetGlow}
          href={eventLink("sunset", today.sunsetGlow)}
          caution="接近日落时请勿直视太阳，定位只用于确认地平线方向。"
        />
        <EventCard
          title="适合观星"
          eyebrow="夜间窗口"
          condition={today.star}
          href={eventLink("stars", today.star)}
        />
        <EventCard
          id="sunrise-event"
          title="早霞"
          eyebrow={tomorrow?.label ?? "明天清晨"}
          condition={today.sunriseGlow}
          href={eventLink("sunrise", today.sunriseGlow)}
          caution="日出前后仍可能有强光，定位只用于确认东侧低空。"
        />
      </div>

      {tomorrow && (
        <details className="mt-5 group">
          <summary className="cursor-pointer list-none text-xs text-white/40 transition-colors hover:text-white/65">
            <span className="mr-2 text-accent/65">+</span>
            查看明天的晚霞、观星和早霞
          </summary>
          <div className="mt-4 grid gap-4 border-t border-white/[0.06] pt-4 sm:grid-cols-3">
            <EventCard title="晚霞" eyebrow={tomorrow.label} condition={tomorrow.sunsetGlow} href={eventLink("sunset", tomorrow.sunsetGlow)} />
            <EventCard title="适合观星" eyebrow="夜间窗口" condition={tomorrow.star} href={eventLink("stars", tomorrow.star)} />
            <EventCard title="早霞" eyebrow="后天清晨" condition={tomorrow.sunriseGlow} href={eventLink("sunrise", tomorrow.sunriseGlow)} />
          </div>
        </details>
      )}

      <SatellitePassPanel
        embedded
        location={location}
        locationStatus={locationStatus}
        onRequestLocation={onRequestLocation}
      />
    </section>
  );
}
