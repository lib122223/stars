"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AchievementBadge from "@/features/achievements/achievement-badge";
import type { AchievementCenterData, AchievementSeries } from "@/lib/achievements/types";

type PageState = "loading" | "ready" | "error";

function percentage(series: AchievementSeries) {
  return series.total > 0 ? Math.round(series.progress / series.total * 100) : 0;
}

function formatUnlockDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export default function AchievementCenter() {
  const [data, setData] = useState<AchievementCenterData | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/achievements", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || json.code !== 0) throw new Error(json.message || "achievements unavailable");
        return json.data as AchievementCenterData;
      })
      .then((achievementData) => {
        setData(achievementData);
        const firstActive = achievementData.series
          .filter((series) => !series.completed)
          .sort((first, second) => percentage(second) - percentage(first))[0];
        setSelectedSlug(firstActive?.slug ?? achievementData.series[0]?.slug ?? null);
        setPageState("ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPageState("error");
      });
    return () => controller.abort();
  }, []);

  const activeSeries = useMemo(() => data?.series
    .filter((series) => !series.completed)
    .sort((first, second) => percentage(second) - percentage(first))
    .slice(0, 3) ?? [], [data]);
  const selected = data?.series.find((series) => series.slug === selectedSlug) ?? data?.series[0] ?? null;

  if (pageState === "loading") {
    return <div className="mx-auto min-h-[calc(100vh-3rem)] max-w-5xl px-4 py-10"><div className="h-7 w-36 animate-pulse rounded bg-white/8" /><div className="mt-8 grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-36 animate-pulse rounded-lg border border-white/5 bg-white/[0.03]" />)}</div></div>;
  }

  if (pageState === "error" || !data) {
    return <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center px-4"><div><h1 className="text-xl font-semibold text-white/85">成就中心暂时无法连接</h1><p className="mt-2 text-sm text-white/40">请先执行最新数据库迁移，然后重新打开此页面。</p></div></div>;
  }

  return (
    <div className="mx-auto min-h-[calc(100vh-3rem)] max-w-5xl px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-5 border-b border-white/8 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs text-accent/60">观测成就</p>
          <h1 className="mt-2 text-2xl font-semibold text-white/90">把真正见过的星空留下来</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/42">只有经过照片识别并由你确认的星星才会推进系列进度。</p>
        </div>
        <div className="grid grid-cols-3 gap-5 text-right sm:gap-7">
          <div><p className="text-xl font-semibold tabular-nums text-white/85">{data.uniqueTargetCount}</p><p className="text-[10px] text-white/32">已确认星体</p></div>
          <div><p className="text-xl font-semibold tabular-nums text-white/85">{data.confirmedCount}</p><p className="text-[10px] text-white/32">观测次数</p></div>
          <div><p className="text-xl font-semibold tabular-nums text-accent/85">{data.completedSeriesCount}/{data.totalSeriesCount}</p><p className="text-[10px] text-white/32">系列徽章</p></div>
        </div>
      </header>

      {!data.account && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-amber-200/10 py-3 text-xs text-amber-50/60">
          <span>当前是浏览器临时进度，登录后可跨设备保存已解锁徽章。</span>
          <Link href="/login" className="text-amber-100/85 hover:text-amber-50">登录或注册</Link>
        </div>
      )}

      <section className="mt-8" aria-labelledby="active-achievement-heading">
        <div className="flex items-end justify-between gap-4">
          <div><h2 id="active-achievement-heading" className="text-base font-medium text-white/80">正在进行</h2><p className="mt-1 text-xs text-white/32">优先展示距离完成最近的系列</p></div>
          <Link href="/sky-map?mode=ar" className="text-xs text-accent/70 hover:text-accent">继续识别星星</Link>
        </div>
        {activeSeries.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {activeSeries.map((series) => (
              <button
                key={series.slug}
                type="button"
                onClick={() => setSelectedSlug(series.slug)}
                className={`flex min-h-36 items-center gap-3 rounded-lg border p-3 text-left transition-colors ${selected?.slug === series.slug ? "border-accent/35 bg-accent/[0.06]" : "border-white/8 bg-white/[0.025] hover:border-white/15"}`}
              >
                <AchievementBadge badgeKey={series.badgeKey} name={series.name} members={series.members} completed={false} size="small" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white/82">{series.name}</span>
                  <span className="mt-1 block text-[11px] text-white/38">{series.progress}/{series.total} 已确认</span>
                  <span className="mt-3 block h-1 overflow-hidden rounded-full bg-white/8"><span className="block h-full rounded-full bg-accent/70" style={{ width: `${percentage(series)}%` }} /></span>
                </span>
              </button>
            ))}
          </div>
        ) : <p className="mt-4 border-y border-emerald-200/10 py-6 text-sm text-emerald-100/65">全部首发系列都已完成。</p>}
      </section>

      <section className="mt-10" aria-labelledby="badge-wall-heading">
        <div><h2 id="badge-wall-heading" className="text-base font-medium text-white/80">徽章墙</h2><p className="mt-1 text-xs text-white/32">已获得的徽章会永久保留在账号中</p></div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {data.series.map((series) => (
            <button
              key={series.slug}
              type="button"
              onClick={() => setSelectedSlug(series.slug)}
              className={`flex min-h-48 flex-col items-center justify-center rounded-lg border px-2 py-4 text-center transition-colors ${selected?.slug === series.slug ? "border-white/22 bg-white/[0.055]" : "border-white/7 bg-white/[0.02] hover:border-white/14"}`}
            >
              <AchievementBadge badgeKey={series.badgeKey} name={series.name} members={series.members} completed={series.completed} />
              <span className="mt-2 text-xs font-medium text-white/75">{series.name}</span>
              <span className={`mt-1 text-[10px] ${series.completed ? "text-emerald-200/65" : "text-white/30"}`}>{series.completed ? "已获得" : `${series.progress}/${series.total}`}</span>
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <section className="mt-10 border-t border-white/8 pt-7" aria-labelledby="series-detail-heading">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xl"><p className="text-[11px] text-white/32">系列详情</p><h2 id="series-detail-heading" className="mt-1 text-xl font-semibold text-white/86">{selected.name}</h2><p className="mt-2 text-sm leading-6 text-white/42">{selected.description}</p>{selected.unlockedAt && <p className="mt-3 text-xs text-emerald-100/60">{formatUnlockDate(selected.unlockedAt)} 解锁</p>}</div>
            <div className="text-left sm:text-right"><p className="text-2xl font-semibold tabular-nums text-white/85">{selected.progress}<span className="text-sm text-white/30">/{selected.total}</span></p><p className="text-[10px] text-white/32">系列进度</p></div>
          </div>
          <div className="mt-5 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {selected.members.map((member) => (
              <div key={member.slug} className="flex min-h-12 items-center justify-between gap-3 border-b border-white/6 py-2.5">
                <div className="min-w-0"><p className={`truncate text-sm ${member.confirmed ? "text-white/72" : "text-white/42"}`}>{member.name}</p><p className="mt-0.5 text-[10px] text-white/25">{member.confirmed ? (member.observations > 0 ? `已确认 ${member.observations} 次` : "已计入徽章") : "尚未确认"}</p></div>
                {member.confirmed ? <span className="text-xs text-emerald-200/65" aria-label="已确认">已完成</span> : <Link href={`/sky-map?mode=ar&target=${encodeURIComponent(member.slug)}`} className="shrink-0 text-xs text-accent/70 hover:text-accent">去识别</Link>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
