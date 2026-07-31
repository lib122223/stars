"use client";

import type { CSSProperties, ReactNode } from "react";

interface HourlyPoint {
  time: string;
  cloudCover: number;
  clarityLevel: string;
  visibility: number;
  humidity: number;
  windSpeed: number;
  precipitationProbability: number;
}

interface HourlyForecastProps {
  data: HourlyPoint[];
}

function cloudColor(cover: number): string {
  if (cover <= 20) return "bg-accent/40";
  if (cover <= 50) return "bg-amber-500/30";
  if (cover <= 80) return "bg-amber-500/50";
  return "bg-red-500/40";
}

function clarityColor(level: string): string {
  if (level.includes("清")) return "text-accent/70";
  if (level.includes("一")) return "text-amber-300/70";
  return "text-red-300/70";
}

function hourLabel(iso: string): string {
  const date = new Date(iso);
  return `${date.getHours()}:00`;
}

function columnStyle(length: number): CSSProperties {
  return { gridTemplateColumns: `repeat(${length}, minmax(42px, 1fr))` };
}

export default function HourlyForecast({ data }: HourlyForecastProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="rounded-xl bg-surface/60 p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-white/35">逐小时天气预报</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/30">
            每一列是一个小时；云量越高，天空越容易被云遮挡。
          </p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/35">
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-accent/40" />少云 0-20%</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-amber-500/50" />多云 51-80%</span>
          <span className="inline-flex items-center gap-1 text-red-200/70"><i className="h-2.5 w-2.5 rounded-sm bg-red-500/40" />红色：云量 80%以上</span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="min-w-[720px] space-y-2">
          <div className="grid gap-1.5" style={columnStyle(data.length)}>
            {data.map((hour) => (
              <p key={hour.time} className="text-center text-[10px] text-white/35">{hourLabel(hour.time)}</p>
            ))}
          </div>

          <MetricRow label="云量" data={data} renderValue={(hour) => (
            <>
              <span className={`block h-6 rounded-sm ${cloudColor(hour.cloudCover)}`} title={`云量 ${hour.cloudCover}%`} />
              <span className="mt-1 block text-[10px]">{hour.cloudCover}%</span>
            </>
          )} />

          <MetricRow label="清晰度" data={data} renderValue={(hour) => (
            <span className={`block text-[10px] ${clarityColor(hour.clarityLevel)}`}>{hour.clarityLevel}</span>
          )} />
          <MetricRow label="湿度" data={data} renderValue={(hour) => (
            <span className="block text-[10px] text-white/30">{hour.humidity}%</span>
          )} />
          <MetricRow label="风速" data={data} renderValue={(hour) => (
            <span className="block text-[10px] text-white/25">{hour.windSpeed}km/h</span>
          )} />
          <MetricRow label="降水概率" data={data} renderValue={(hour) => (
            <span className={`block text-[10px] ${hour.precipitationProbability > 30 ? "text-blue-300/70" : "text-white/25"}`}>
              {hour.precipitationProbability}%
            </span>
          )} />
        </div>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-white/25">
        红色只表示云量较多，不等于正在下雨；是否下雨请看最后一行的蓝色“降水概率”。
      </p>
    </div>
  );
}

function MetricRow({
  label,
  data,
  renderValue,
}: {
  label: string;
  data: HourlyPoint[];
  renderValue: (hour: HourlyPoint) => ReactNode;
}) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-2 border-t border-white/[0.05] pt-2">
      <span className="pt-1 text-[10px] text-white/35">{label}</span>
      <div className="grid gap-1.5 text-center" style={columnStyle(data.length)}>
        {data.map((hour) => <div key={hour.time}>{renderValue(hour)}</div>)}
      </div>
    </div>
  );
}
