"use client";

import { useCallback, useEffect, useState } from "react";

interface SatellitePass {
  id: string;
  start: { time: string; azimuth: number; elevation: number; direction: string };
  peak: { time: string; azimuth: number; direction: string; elevation: number; rangeKm: number };
  end: { time: string; azimuth: number; elevation: number; direction: string };
  durationMinutes: number;
  illuminatedDuringPass: boolean;
  observerSunAltitude: number;
  cloudCover: number | null;
  visibility: { level: "easy" | "possible" | "difficult"; label: string; reason: string };
}

interface SatelliteForecast {
  generatedAt: string;
  tleEpoch: string;
  passes: SatellitePass[];
}

interface SatellitePassPanelProps {
  embedded?: boolean;
  location: { lat: number; lng: number } | null;
  locationStatus: "pending" | "granted" | "denied";
  onRequestLocation: () => void;
}

type LoadState =
  | { status: "idle" }
  | { status: "error"; requestKey: string }
  | { status: "ready"; requestKey: string; data: SatelliteForecast };

type CurrentLoadState = LoadState | { status: "loading" };

const visibilityStyles = {
  easy: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200/80",
  possible: "border-amber-300/20 bg-amber-300/10 text-amber-100/70",
  difficult: "border-white/10 bg-white/[0.04] text-white/35",
};

function localDateLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((targetDay - today) / 86_400_000);
  const day = dayDiff === 0 ? "今天" : dayDiff === 1 ? "明天" : date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
  return `${day} ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

function countdownLabel(iso: string, now: number): string {
  const milliseconds = new Date(iso).getTime() - now;
  if (milliseconds <= 0) return "正在过境";
  const totalMinutes = Math.max(1, Math.ceil(milliseconds / 60_000));
  if (totalMinutes < 60) return `${totalMinutes} 分钟后`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} 小时 ${minutes} 分钟后` : `${hours} 小时后`;
}

function directionLabel(point: { direction: string; azimuth: number }): string {
  return `${point.direction} ${Math.round(point.azimuth)}°`;
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function skyMapLink(pass: SatellitePass, mode: "observe" | "ar"): string {
  const params = new URLSearchParams({
    mode,
    satellite: "iss",
    startTime: pass.start.time,
    startAzimuth: String(pass.start.azimuth),
    startElevation: String(pass.start.elevation),
    startDirection: pass.start.direction,
    peakTime: pass.peak.time,
    peakAzimuth: String(pass.peak.azimuth),
    peakElevation: String(pass.peak.elevation),
    peakDirection: pass.peak.direction,
    endTime: pass.end.time,
    endAzimuth: String(pass.end.azimuth),
    endElevation: String(pass.end.elevation),
    endDirection: pass.end.direction,
  });
  return `/sky-map?${params.toString()}`;
}

export default function SatellitePassPanel({
  embedded = false,
  location,
  locationStatus,
  onRequestLocation,
}: SatellitePassPanelProps) {
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [showAllPasses, setShowAllPasses] = useState(false);
  const latitude = location?.lat;
  const longitude = location?.lng;
  const requestKey = latitude != null && longitude != null
    ? `${latitude}:${longitude}:${refreshKey}`
    : null;
  const currentState: CurrentLoadState = requestKey == null
    ? { status: "idle" }
    : state.status !== "idle" && state.requestKey === requestKey
    ? state
    : { status: "loading" };

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (latitude == null || longitude == null || !requestKey) return;

    const controller = new AbortController();
    const params = new URLSearchParams({ lat: String(latitude), lng: String(longitude) });
    fetch(`/api/tools/satellite-passes?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || json.code !== 0 || !json.data) throw new Error(json.message);
        setState({ status: "ready", requestKey, data: json.data as SatelliteForecast });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error", requestKey });
      });

    return () => controller.abort();
  }, [latitude, longitude, requestKey]);

  const futurePasses = currentState.status === "ready"
    ? currentState.data.passes.filter((pass) => new Date(pass.end.time).getTime() > now)
    : [];
  const visiblePasses = showAllPasses ? futurePasses : futurePasses.slice(0, 1);

  const retry = useCallback(() => setRefreshKey((key) => key + 1), []);

  return (
    <section id="satellite-passes" className={`scroll-mt-20 ${embedded ? "mt-6 border-t border-white/[0.08] pt-5" : "mt-5 rounded-xl border border-white/[0.06] bg-surface/60 p-5 sm:p-7"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-accent/40">人造卫星提醒</p>
          <h2 className="mt-1 text-base font-medium text-white/80">ISS 未来 24 小时过境</h2>
        </div>
        {futurePasses[0] && (
          <div className="text-right">
            <p className="text-[10px] text-white/25">下一次进入 10° 仰角</p>
            <p className="mt-1 text-sm font-medium text-accent/75">
              {countdownLabel(futurePasses[0].start.time, now)}
            </p>
          </div>
        )}
      </div>

      {locationStatus === "pending" && (
        <div className="mt-5 h-20 animate-pulse rounded-md bg-white/[0.035]" />
      )}

      {locationStatus === "denied" && (
        <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/35">ISS 方位必须基于真实位置计算，请先允许浏览器定位。</p>
          <button
            type="button"
            onClick={onRequestLocation}
            className="self-start rounded-md bg-white/[0.07] px-3 py-2 text-xs text-white/55 transition-colors hover:bg-white/[0.11]"
          >
            重新获取位置
          </button>
        </div>
      )}

      {locationStatus === "granted" && currentState.status === "loading" && (
        <div className="mt-5 space-y-2">
          {[1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-md bg-white/[0.035]" />)}
        </div>
      )}

      {locationStatus === "granted" && currentState.status === "error" && (
        <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/35">轨道或天气数据暂时无法加载。</p>
          <button
            type="button"
            onClick={retry}
            className="self-start rounded-md bg-white/[0.07] px-3 py-2 text-xs text-white/55 transition-colors hover:bg-white/[0.11]"
          >
            重试
          </button>
        </div>
      )}

      {locationStatus === "granted" && currentState.status === "ready" && futurePasses.length === 0 && (
        <div className="mt-5 border-t border-white/[0.06] pt-4">
          <p className="text-sm text-white/40">当前位置未来 24 小时暂无高于 10° 的 ISS 过境。</p>
          <p className="mt-1 text-xs text-white/20">轨道会持续变化，稍后重新查看即可更新预测。</p>
        </div>
      )}

      {locationStatus === "granted" && currentState.status === "ready" && futurePasses.length > 0 && (
        <div className="mt-5 divide-y divide-white/[0.06] border-y border-white/[0.06]">
          {visiblePasses.map((pass) => (
            <article key={pass.id} className="py-4 first:pt-3 last:pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white/70">{localDateLabel(pass.start.time)}</p>
                  <p className="mt-1 text-[11px] text-white/25">持续约 {pass.durationMinutes} 分钟</p>
                </div>
                <span className={`rounded-md border px-2 py-1 text-[11px] ${visibilityStyles[pass.visibility.level]}`}>
                  {pass.visibility.label}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/[0.025] px-2 py-2.5">
                  <p className="text-[10px] text-white/20">出现</p>
                  <p className="mt-1 text-xs text-white/55">{directionLabel(pass.start)}</p>
                  <p className="mt-1 text-[10px] text-white/20">{timeLabel(pass.start.time)}</p>
                </div>
                <div className="bg-white/[0.04] px-2 py-2.5">
                  <p className="text-[10px] text-white/20">最高点</p>
                  <p className="mt-1 text-xs text-white/65">{directionLabel(pass.peak)}</p>
                  <p className="mt-1 text-[10px] text-white/20">{timeLabel(pass.peak.time)}</p>
                </div>
                <div className="bg-white/[0.025] px-2 py-2.5">
                  <p className="text-[10px] text-white/20">离开</p>
                  <p className="mt-1 text-xs text-white/55">{directionLabel(pass.end)}</p>
                  <p className="mt-1 text-[10px] text-white/20">{timeLabel(pass.end.time)}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-white/30">
                <span>最高仰角 {Math.round(pass.peak.elevation)}°</span>
                <span>最近约 {pass.peak.rangeKm} km</span>
                <span>{pass.cloudCover == null ? "云量待更新" : `云量 ${pass.cloudCover}%`}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/35">{pass.visibility.reason}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={skyMapLink(pass, "observe")}
                  className="rounded-md border border-emerald-200/20 bg-emerald-200/10 px-2.5 py-1.5 text-[11px] text-emerald-50/80 transition-colors hover:bg-emerald-200/15"
                >
                  观察模式定位起点
                </a>
                <a
                  href={skyMapLink(pass, "ar")}
                  className="rounded-md border border-cyan-200/20 bg-cyan-200/10 px-2.5 py-1.5 text-[11px] text-cyan-50/80 transition-colors hover:bg-cyan-200/15"
                >
                  AR 模式定位起点
                </a>
              </div>
            </article>
          ))}
        </div>
      )}

      {futurePasses.length > 1 && (
        <button
          type="button"
          onClick={() => setShowAllPasses((value) => !value)}
          className="mt-3 text-xs text-white/35 transition-colors hover:text-white/65"
        >
          {showAllPasses ? "收起其余过境" : `查看其余 ${futurePasses.length - 1} 次过境`}
        </button>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-white/15">
        方位以正北 0° 顺时针计算；时间为设备本地时间。预测基于 CelesTrak 最新轨道根数与 Open-Meteo 云量，实际可见性会受建筑、雾霾和定位误差影响。
      </p>
    </section>
  );
}
