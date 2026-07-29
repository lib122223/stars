"use client";

import { useEffect, useMemo, useState } from "react";

export interface SatelliteGuidePoint {
  time: string;
  azimuth: number;
  elevation: number;
  direction: string;
}

export interface SatelliteGuidePass {
  start: SatelliteGuidePoint;
  peak: SatelliteGuidePoint;
  end: SatelliteGuidePoint;
  durationMinutes: number;
}

interface SatellitePassGuideProps {
  pass: SatelliteGuidePass;
  mode: "observe" | "ar";
  orientation: { azimuth: number; pitch: number } | null;
  onEnableOrientation: () => void;
}

function signedAngleDelta(target: number, current: number): number {
  return ((target - current + 540) % 360) - 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function interpolatePoint(start: SatelliteGuidePoint, end: SatelliteGuidePoint, amount: number): SatelliteGuidePoint {
  const delta = signedAngleDelta(end.azimuth, start.azimuth);
  return {
    time: start.time,
    azimuth: (start.azimuth + delta * amount + 360) % 360,
    elevation: start.elevation + (end.elevation - start.elevation) * amount,
    direction: start.direction,
  };
}

function formatCountdown(milliseconds: number): string {
  const minutes = Math.max(1, Math.ceil(milliseconds / 60_000));
  if (minutes < 60) return `${minutes} 分钟后`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟后`;
}

export default function SatellitePassGuide({
  pass,
  mode,
  orientation,
  onEnableOrientation,
}: SatellitePassGuideProps) {
  const [now, setNow] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  const timing = useMemo(() => {
    const start = new Date(pass.start.time).getTime();
    const peak = new Date(pass.peak.time).getTime();
    const end = new Date(pass.end.time).getTime();
    const before = now < start;
    const finished = now >= end;
    const rising = !before && !finished && now < peak;
    const currentPoint = rising
      ? interpolatePoint(pass.start, pass.peak, (now - start) / Math.max(1, peak - start))
      : interpolatePoint(pass.peak, pass.end, (now - peak) / Math.max(1, end - peak));

    return { start, end, before, finished, rising, currentPoint };
  }, [now, pass]);

  const guidancePoint = timing.before ? pass.start : timing.currentPoint;
  const markerPosition = orientation
    ? {
        left: clamp(50 + signedAngleDelta(guidancePoint.azimuth, orientation.azimuth) / 1.72, 4, 96),
        top: clamp(50 + (orientation.pitch - guidancePoint.elevation) / 0.9, 8, 92),
      }
    : null;
  const movementLabel = pass.start.direction === pass.end.direction
    ? `沿${pass.start.direction}方向经过`
    : `${pass.start.direction} → ${pass.end.direction}`;

  const phase = timing.before
    ? `尚未出现 · ${formatCountdown(timing.start - now)}`
    : timing.finished
      ? "本次过境已结束"
      : timing.rising
        ? "正在升高 · 向峰值移动"
        : "正在下降 · 向离开点移动";

  return (
    <div className="pointer-events-none absolute inset-0 z-[22]">
      {markerPosition && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-500"
          style={{ left: `${markerPosition.left}%`, top: `${markerPosition.top}%` }}
        >
          <div className="h-8 w-8 rounded-full border border-emerald-200/80 bg-emerald-200/10 shadow-[0_0_22px_rgba(110,231,183,0.32)]" />
          <div className="absolute left-1/2 top-9 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/60 px-2 py-1 text-[10px] text-emerald-50/85 backdrop-blur-sm">
            ISS {timing.before ? "起点" : "当前"} · {guidancePoint.direction} {Math.round(guidancePoint.azimuth)}° / 仰角 {Math.round(guidancePoint.elevation)}°
          </div>
        </div>
      )}

      <div className="pointer-events-auto absolute bottom-20 left-4 right-4 mx-auto max-w-xl rounded-xl border border-emerald-200/15 bg-[#071711]/90 p-3 text-emerald-50/80 shadow-2xl shadow-black/35 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-200/55">
              ISS 过境定位 · {mode === "ar" ? "AR 模式" : "观察模式"}
            </p>
            <p className="mt-1 text-sm font-medium text-emerald-50/90">{phase}</p>
            <p className={collapsed ? "hidden" : "mt-1 text-[11px] leading-relaxed text-emerald-50/55"}>
              先对准出现点：{pass.start.direction} {Math.round(pass.start.azimuth)}°，仰角 {Math.round(pass.start.elevation)}°。
              {timing.before
                ? "卫星尚未出现，起点不会随时间跳动。"
                : `当前预计位于 ${timing.currentPoint.direction} ${Math.round(timing.currentPoint.azimuth)}°，仰角 ${Math.round(timing.currentPoint.elevation)}°。`}
              {mode === "ar" && " 开启方向后，再点击右上角的 AR 星空校准进入相机引导。"}
            </p>
            <p className="mt-1 text-[10px] text-emerald-50/65">移动方向：{movementLabel}</p>
          </div>
          {!orientation && !collapsed && (
            <button
              type="button"
              onClick={onEnableOrientation}
              className="pointer-events-auto shrink-0 rounded-md border border-emerald-200/20 bg-emerald-200/10 px-2.5 py-1.5 text-[11px] text-emerald-50/80 transition-colors hover:bg-emerald-200/15"
            >
              开启方向定位
            </button>
          )}
        </div>

        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
            className="pointer-events-auto rounded-md border border-emerald-200/15 bg-emerald-200/5 px-2 py-1 text-[10px] text-emerald-50/60 transition-colors hover:bg-emerald-200/10 hover:text-emerald-50/85"
          >
            {collapsed ? "展开" : "收起"}
          </button>
        </div>

        <div className={collapsed ? "hidden" : "mt-3 flex justify-between text-[10px] text-emerald-50/45"}>
          <span>出现 {pass.start.direction}</span>
          <span>峰值 {pass.peak.direction}</span>
          <span>离开 {pass.end.direction}</span>
        </div>
      </div>
    </div>
  );
}
