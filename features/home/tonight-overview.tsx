"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface TonightOverviewProps {
  location: { lat: number; lng: number } | null;
}

interface ConditionScore {
  score: number;
  label: string;
  bestReferenceTime: string | null;
  windowStart: string | null;
  windowEnd: string | null;
}

interface SiteConditions {
  lightPollution: {
    available: boolean;
    darknessScore: number;
    label: string;
  };
  visibleSky: {
    observationTime: string;
    limitingMagnitude: number;
    objects: VisibleObject[];
    recommended: VisibleObject[];
  };
  days: Array<{
    label: string;
    star: ConditionScore;
    sunsetGlow: ConditionScore;
    sunriseGlow: ConditionScore;
  }>;
}

interface VisibleObject {
  slug: string;
  name: string;
  type: "bright_star" | "planet" | "moon";
  altitude: number;
  azimuth: number;
  magnitude: number;
  direction: string;
  visibilityLabel: string;
}

function scoreTone(score: number): string {
  if (score >= 82) return "text-emerald-300";
  if (score >= 68) return "text-accent";
  if (score >= 50) return "text-amber-200";
  return "text-white/35";
}

function windowText(condition?: ConditionScore): string {
  if (!condition) return "等待定位后估算";
  if (condition.windowStart && condition.windowEnd) return `${condition.windowStart} - ${condition.windowEnd}`;
  return condition.bestReferenceTime ?? "暂无窗口";
}

export default function TonightOverview({ location }: TonightOverviewProps) {
  const locLat = location?.lat;
  const locLng = location?.lng;
  const [conditions, setConditions] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error" }
    | { status: "ok"; data: SiteConditions }
  >({ status: "idle" });

  useEffect(() => {
    if (locLat == null || locLng == null) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      lat: locLat.toFixed(5),
      lng: locLng.toFixed(5),
    });

    fetch(`/api/tools/site-conditions?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (json.code === 0 && json.data) setConditions({ status: "ok", data: json.data as SiteConditions });
        else setConditions({ status: "error" });
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setConditions({ status: "error" });
      });

    return () => controller.abort();
  }, [locLat, locLng]);

  const effectiveConditions: typeof conditions = locLat == null || locLng == null ? { status: "idle" } : conditions;
  const today = effectiveConditions.status === "ok" ? effectiveConditions.data.days[0] : null;
  const visibleSky = effectiveConditions.status === "ok" ? effectiveConditions.data.visibleSky : null;
  const visibleObjects = visibleSky?.recommended ?? [];
  const lightPollution = effectiveConditions.status === "ok" ? effectiveConditions.data.lightPollution : null;

  return (
    <section className="mt-5 space-y-3">
      <div className="rounded-xl border border-white/5 bg-surface/45 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-white/25">今晚观测</p>
            <p className="mt-1 text-sm text-white/70">
              {effectiveConditions.status === "loading"
                ? "正在计算当前位置条件..."
                : effectiveConditions.status === "error"
                ? "观测条件暂时无法加载"
                : "看星星、晚霞、早霞概览"}
            </p>
          </div>
          <Link href="/tools" className="rounded-md bg-white/[0.06] px-2 py-1 text-[10px] text-white/35">
            工具页
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <ConditionMini title="看星" condition={today?.star} />
          <ConditionMini title="晚霞" condition={today?.sunsetGlow} />
          <ConditionMini title="早霞" condition={today?.sunriseGlow} />
        </div>
        <p className="mt-3 text-[10px] text-white/24">
          最佳看星窗口：{windowText(today?.star)}
        </p>
      </div>

      <div className="rounded-xl border border-white/5 bg-surface/35 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-white/25">今晚可见天体</p>
            <p className="mt-1 text-[10px] text-white/20">
              {visibleSky
                ? `${lightPollution?.label ?? "夜光待确认"} · 肉眼极限约 ${visibleSky.limitingMagnitude.toFixed(1)} 等`
                : location ? "正在综合夜光、天气和月光" : "获取定位后显示真实可见对象"}
            </p>
          </div>
          <Link href="/sky-map" className="rounded-md bg-white/[0.06] px-2 py-1 text-[10px] text-white/35">
            星图
          </Link>
        </div>

        {visibleObjects.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {visibleObjects.map((obj) => (
              <Link
                key={`${obj.type}-${obj.slug}`}
                href={`/sky-map?target=${obj.slug}&source=primary`}
                className="rounded-lg bg-white/[0.035] px-3 py-2 transition-colors hover:bg-white/[0.06]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-white/65">{obj.name}</span>
                  <span className="text-[10px] text-accent/55">{obj.direction}</span>
                </div>
                <p className="mt-1 text-[10px] text-white/24">
                  高度 {obj.altitude.toFixed(0)}° · {obj.visibilityLabel}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-lg bg-white/[0.035] px-3 py-3 text-xs text-white/28">
            暂无定位时先进入星图浏览，获取位置后会显示今晚真实可见对象。
          </div>
        )}
      </div>
    </section>
  );
}

function ConditionMini({ title, condition }: { title: string; condition?: ConditionScore }) {
  return (
    <div className="rounded-lg bg-white/[0.035] p-2.5">
      <p className="text-[10px] text-white/28">{title}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${condition ? scoreTone(condition.score) : "text-white/25"}`}>
        {condition ? condition.score : "--"}
      </p>
      <p className="text-[10px] text-white/24">{condition?.label ?? "等待"}</p>
    </div>
  );
}
