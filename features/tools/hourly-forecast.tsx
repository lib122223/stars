"use client";

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
  if (level === "清晰") return "text-accent/60";
  if (level === "一般") return "text-amber-500/50";
  return "text-red-500/40";
}

function hourLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:00`;
}

export default function HourlyForecast({ data }: HourlyForecastProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="rounded-xl bg-surface/60 p-6 sm:p-8">
      <p className="text-xs text-white/25 mb-4">今夜小时预报</p>

      {/* 时间列头 */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
        {data.map((h) => (
          <div key={h.time} className="text-center">
            <p className="text-[10px] text-white/30 mb-2">{hourLabel(h.time)}</p>
          </div>
        ))}
      </div>

      {/* 云量行 — 色块 + 百分比 */}
      <div className="grid gap-1.5 mt-1" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
        {data.map((h) => (
          <div key={h.time} className="flex flex-col items-center gap-1">
            <div
              className={`h-6 w-full rounded-sm ${cloudColor(h.cloudCover)}`}
              title={`云量 ${h.cloudCover}%`}
            />
            <span className="text-[10px] text-white/35">{h.cloudCover}%</span>
          </div>
        ))}
      </div>

      {/* 清晰度 + 湿度 + 风速 + 降水 */}
      <div className="mt-2 space-y-1">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
          {data.map((h) => (
            <span key={h.time} className={`text-[10px] text-center ${clarityColor(h.clarityLevel)}`}>
              {h.clarityLevel}
            </span>
          ))}
        </div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
          {data.map((h) => (
            <span key={h.time} className="text-[10px] text-white/25 text-center">
              {h.humidity}%
            </span>
          ))}
        </div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
          {data.map((h) => (
            <span key={h.time} className="text-[10px] text-white/20 text-center">
              {h.windSpeed}km/h
            </span>
          ))}
        </div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
          {data.map((h) => (
            <span key={h.time} className={`text-[10px] text-center ${h.precipitationProbability > 30 ? "text-blue-400/50" : "text-white/15"}`}>
              {h.precipitationProbability}%
            </span>
          ))}
        </div>
      </div>

      {/* 行标签 */}
      <div className="mt-3 space-y-1">
        <div className="flex gap-3 text-[10px] text-white/15">
          <span>云量</span>
          <span className={`w-2.5 h-2.5 rounded-sm mt-0.5 ${cloudColor(5)}`} />
        </div>
        <div className="flex gap-4 text-[10px] text-white/15">
          <span>清晰</span>
          <span>湿度</span>
          <span>风速</span>
          <span>降水</span>
        </div>
      </div>
    </div>
  );
}
