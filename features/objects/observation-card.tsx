"use client";

import type { TimeContextKey } from "@/lib/time-context";
import { TIME_CONTEXT_KEYS, timeContextLabel } from "@/lib/time-context";

export interface ObservationData {
  status: "visible" | "rising_soon" | "not_visible";
  statusText: string;
  direction: string;
  azimuth: number;
  altitude: number;
  latitude: number;
  longitude: number;
  riseTime: string | null;
  setTime: string | null;
  advice: string;
}

interface ObservationCardProps {
  data: ObservationData | null;
  timeContext: TimeContextKey;
  onTimeContextChange: (key: TimeContextKey) => void;
}

/**
 * 动态观测卡 — 展示指定时刻的真实观测数据
 * 离散时间切换由父组件控制
 */
export default function ObservationCard({ data, timeContext, onTimeContextChange }: ObservationCardProps) {

  if (!data) {
    return (
      <div className="rounded-xl bg-surface/60 p-6 sm:p-8 text-center">
        <p className="text-sm text-white/25">需要定位权限，才能计算当前位置的方向和仰角</p>
      </div>
    );
  }

  const statusColor =
    data.status === "visible" ? "bg-green-500/70" :
    data.status === "rising_soon" ? "bg-amber-400/70" :
    "bg-white/20";

  return (
    <div className="rounded-xl bg-surface/60 p-6 sm:p-8">
      {/* 离散时间切换 */}
      <div className="flex items-center gap-1 mb-5">
        {TIME_CONTEXT_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => onTimeContextChange(key)}
            className={`rounded px-2.5 py-1 text-xs transition-colors ${
              timeContext === key
                ? "bg-accent/15 text-accent/80"
                : "text-white/20 hover:text-white/35"
            }`}
          >
            {timeContextLabel(key)}
          </button>
        ))}
      </div>

      <p className="mb-4 text-[11px] tabular-nums text-white/25">
        当前位置 {Math.abs(data.latitude).toFixed(2)}°{data.latitude >= 0 ? "N" : "S"}
        {" · "}
        {Math.abs(data.longitude).toFixed(2)}°{data.longitude >= 0 ? "E" : "W"}
      </p>

      {/* 6 项观测数据 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4">
        <div>
          <p className="text-[10px] text-white/20 mb-1">当前状态</p>
          <p className="text-sm text-white/70 flex items-center gap-1.5">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusColor}`} />
            {data.statusText}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-white/20 mb-1">方位</p>
          <p className="text-sm text-white/70 tabular-nums">
            {data.direction} · {data.azimuth.toFixed(0)}°
          </p>
        </div>
        <div>
          <p className="text-[10px] text-white/20 mb-1">仰角</p>
          <p className="text-sm text-white/70 tabular-nums">
            {data.altitude.toFixed(0)}°{data.altitude < 0 ? " · 地平线下" : ""}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-white/20 mb-1">升起</p>
          <p className="text-sm text-white/70">{data.riseTime ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] text-white/20 mb-1">落下</p>
          <p className="text-sm text-white/70">{data.setTime ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] text-white/20 mb-1">今晚建议</p>
          <p className="text-sm text-white/70">{data.advice}</p>
        </div>
      </div>
    </div>
  );
}
