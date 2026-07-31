"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AchievementCenterData, AchievementSeries } from "@/lib/achievements/types";

export interface ActiveAchievementTask {
  series: AchievementSeries;
  nextMember: AchievementSeries["members"][number] | null;
  selectedMember: AchievementSeries["members"][number] | null;
}

interface AchievementTaskStripProps {
  data: AchievementCenterData | null;
  selectedSlug: string | null;
}

function selectActiveTask(data: AchievementCenterData | null, selectedSlug: string | null): ActiveAchievementTask | null {
  if (!data) return null;

  const activeSeries = data.series
    .filter((series) => !series.completed)
    .sort((first, second) => {
      const firstRatio = first.total > 0 ? first.progress / first.total : 0;
      const secondRatio = second.total > 0 ? second.progress / second.total : 0;
      return secondRatio - firstRatio || second.progress - first.progress;
    });
  const series = activeSeries[0] ?? data.series.find((item) => item.completed) ?? null;
  if (!series) return null;

  return {
    series,
    nextMember: series.members.find((member) => !member.confirmed) ?? null,
    selectedMember: selectedSlug
      ? series.members.find((member) => member.slug === selectedSlug) ?? null
      : null,
  };
}

export function getActiveAchievementTask(data: AchievementCenterData | null, selectedSlug: string | null) {
  return selectActiveTask(data, selectedSlug);
}

export default function AchievementTaskStrip({ data, selectedSlug }: AchievementTaskStripProps) {
  const [collapsed, setCollapsed] = useState(false);
  const task = useMemo(() => selectActiveTask(data, selectedSlug), [data, selectedSlug]);

  if (!task) return null;

  const { series, nextMember, selectedMember } = task;
  const completed = series.completed || !nextMember;
  const targetHref = nextMember
    ? `/sky-map?mode=observe&target=${encodeURIComponent(nextMember.slug)}&capture=1`
    : "/achievements";

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="pointer-events-auto absolute left-3 top-24 z-[32] rounded-full border border-amber-200/20 bg-[#111a1c]/85 px-3 py-2 text-[11px] text-amber-100/75 shadow-xl shadow-black/25 backdrop-blur-md"
        aria-label="展开当前成就任务"
      >
        任务 {series.progress}/{series.total}
      </button>
    );
  }

  return (
    <aside className="pointer-events-auto absolute left-3 top-24 z-[32] w-64 max-w-[calc(100vw-1.5rem)] rounded-lg border border-amber-200/15 bg-[#111a1c]/88 p-2 text-white/75 shadow-2xl shadow-black/25 backdrop-blur-md sm:left-4 sm:w-80 sm:p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em] text-amber-200/55">当前成就任务</p>
          <p className="mt-0.5 truncate text-xs font-medium text-white/90 sm:mt-1 sm:text-sm">{series.name}</p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="shrink-0 rounded-md px-2 py-1 text-[11px] text-white/35 hover:bg-white/[0.06] hover:text-white/65"
          aria-label="收起当前成就任务"
        >
          收起
        </button>
      </div>

      <div className="mt-1.5 flex items-center gap-2 sm:mt-2">
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-amber-200/75" style={{ width: `${series.total > 0 ? (series.progress / series.total) * 100 : 0}%` }} />
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-amber-100/70">{series.progress}/{series.total}</span>
      </div>

      {completed ? (
        <p className="mt-1 line-clamp-1 text-[11px] leading-relaxed text-emerald-100/70 sm:mt-2 sm:line-clamp-none sm:text-xs">这个系列已完成，徽章已经解锁。</p>
      ) : selectedMember ? (
        <p className="mt-1 line-clamp-1 text-[11px] leading-relaxed text-cyan-100/70 sm:mt-2 sm:line-clamp-none sm:text-xs">
          {selectedMember.confirmed ? `${selectedMember.name} 已计入系列。` : `${selectedMember.name} 是当前目标。`}
          {!selectedMember.confirmed && "拍摄识别后，点击“确认观测”才会计入。"}
        </p>
      ) : (
        <p className="mt-1 line-clamp-1 text-[11px] leading-relaxed text-white/50 sm:mt-2 sm:line-clamp-none sm:text-xs">
          下一目标：<span className="text-white/85">{nextMember.name}</span>。拍摄识别后，选择候选并点击“确认观测”，才会推进成就。
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 sm:mt-3">
        <Link href={targetHref} className="rounded-md border border-amber-200/20 bg-amber-200/10 px-2 py-1 text-[10px] text-amber-50/85 hover:bg-amber-200/15 sm:px-2.5 sm:py-1.5 sm:text-[11px]">
          <span className="sm:hidden">{completed ? "查看徽章" : "去识别"}</span>
          <span className="hidden sm:inline">{completed ? "查看徽章" : "去识别下一目标"}</span>
        </Link>
        <Link href="/achievements" className="hidden text-[11px] text-white/35 hover:text-white/65 sm:inline">查看全部任务</Link>
      </div>
    </aside>
  );
}
