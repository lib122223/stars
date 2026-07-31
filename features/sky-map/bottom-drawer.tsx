"use client";

import Link from "next/link";
import type { ActiveAchievementTask } from "@/features/sky-map/achievement-task-strip";
import { getConstellationForStar } from "@/lib/astronomy/constellations";

interface GuideContent {
  target: string;
  reason: string;
}

interface ObjectContent {
  name: string;
  type: string;
  slug: string;
  isPreviewOnly?: boolean;
}

interface BottomDrawerProps {
  guide: GuideContent;
  selected: ObjectContent | null;
  onSimulateClick: () => void;
  onDismiss?: () => void;
  obsStatus?: string | null;
  source?: "primary" | "secondary" | "related" | "search";
  isObservationMode?: boolean;
  isArMode?: boolean;
  mode?: "2d" | "observe" | "ar";
  viewPose?: { azimuth: number; pitch: number; gamma?: number } | null;
  achievementTask?: ActiveAchievementTask | null;
}

const typeLabel: Record<string, string> = {
  star: "恒星",
  constellation: "星座",
  bright_star: "亮星",
  planet: "行星",
  galaxy: "星系",
  nebula: "星云",
  open_cluster: "疏散星团",
  globular_cluster: "球状星团",
  coord: "坐标",
};

export default function BottomDrawer({
  guide,
  selected,
  onSimulateClick,
  onDismiss,
  obsStatus,
  source = "primary",
  isObservationMode = false,
  isArMode = false,
  mode,
  viewPose = null,
  achievementTask = null,
}: BottomDrawerProps) {
  const observationTargetName = selected && (selected.type === "bright_star" || selected.type === "star")
    ? `${getConstellationForStar(selected.slug)?.nameZh ?? ""}${getConstellationForStar(selected.slug) ? " · " : ""}${selected.name}`
    : selected?.name;
  const observationHref = selected
    ? `/observations?targetName=${encodeURIComponent(observationTargetName ?? selected.name)}&targetSlug=${encodeURIComponent(selected.slug)}&objectType=${encodeURIComponent(selected.type)}`
    : "/observations";
  const detailSource = mode ?? (isArMode ? "ar" : isObservationMode ? "observe" : "2d");
  const detailParams = new URLSearchParams({ from: detailSource });
  if (viewPose) {
    detailParams.set("returnAz", String(viewPose.azimuth));
    detailParams.set("returnPitch", String(viewPose.pitch));
    if (viewPose.gamma != null) detailParams.set("returnGamma", String(viewPose.gamma));
  }

  return (
    <div className="border-t border-white/5 bg-surface/90 backdrop-blur-sm">
      {selected ? (
        /* 中等聚焦态：目标名 · 短状态 · 查看详情 · 缩回天空 */
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 transition-opacity duration-200">
          <div className="flex items-center gap-3">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                selected.type === "coord" ? "bg-white/20" : "bg-accent"
              }`}
            />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white/90">
                  {selected.name}
                </p>
                <span className="rounded border border-cyan-200/20 bg-cyan-200/[0.08] px-1.5 py-0.5 text-[9px] text-cyan-100/70">
                  已选中
                </span>
              </div>
              <p className="text-xs text-white/40">
                {typeLabel[selected.type] ?? selected.type}
                {selected.isPreviewOnly
                  ? " · 内容暂未收录"
                  : selected.type !== "coord" && obsStatus
                  ? ` · ${obsStatus}`
                  : selected.type !== "coord" && " · 已找到目标"}
              </p>
              {achievementTask?.selectedMember && (
                <p className="mt-1 text-[10px] text-amber-100/65">
                  {achievementTask.selectedMember.confirmed
                    ? `已计入${achievementTask.series.name}系列`
                    : achievementTask.selectedMember.slug === achievementTask.nextMember?.slug
                      ? "当前成就目标：拍摄识别后点击确认观测"
                      : `${achievementTask.series.name}系列目标`}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/30 transition-colors hover:bg-white/10 hover:text-white/50"
              >
                缩回天空
              </button>
            )}
            {selected.isPreviewOnly ? (
              <>
                <Link
                  href={observationHref}
                  className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-white/45 transition-colors hover:bg-white/[0.10] hover:text-white/70"
                >
                  记录观测
                </Link>
                <span className="text-xs text-white/10">详情将在后续版本补充</span>
              </>
            ) : selected.type !== "coord" ? (
              <>
                <Link
                  href={observationHref}
                  className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-white/45 transition-colors hover:bg-white/[0.10] hover:text-white/70"
                >
                  记录观测
                </Link>
                <Link
                  href={`/objects/${selected.slug}?${detailParams.toString()}`}
                  className="rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/25"
                >
                  查看详情
                </Link>
              </>
            ) : (
              <span className="text-xs text-white/15">识别未匹配</span>
            )}
          </div>
        </div>
      ) : (
        /* 点击前：引导去找什么 */
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm text-white/70">
              {source === "primary" ? "今晚先找" : source === "secondary" ? "也可以看看" : source === "related" ? "接下来可以找" : "正在找"}{" "}
              <span className="text-white/90">{guide.target}</span>
            </p>
            <p className="text-xs text-white/30 mt-0.5">{guide.reason}</p>
          </div>
          <button
            onClick={onSimulateClick}
            className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-white/40 transition-colors hover:bg-white/10"
          >
            模拟点击
          </button>
        </div>
      )}
    </div>
  );
}
