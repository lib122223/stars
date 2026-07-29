"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Pose = { azimuth: number; pitch: number; gamma: number } | null;
type CalibrationState = "idle" | "requesting" | "active" | "denied" | "unsupported";
type ArTarget = { name: string; type: string; slug: string };

interface ArSkyCalibrationProps {
  active: boolean;
  orientation: Pose;
  aimTarget: ArTarget | null;
  nearbyTargets: ArTarget[];
  lockedTarget: ArTarget | null;
  onActivateOrientation: () => Promise<boolean>;
  onDeactivateOrientation: () => void;
  onActiveChange: (active: boolean) => void;
  onLockTarget: (target: ArTarget | null) => void;
  onSwitchToObservation: () => void;
  focusedConstellationName?: string | null;
  launchRequest?: number;
  launcherVisible?: boolean;
}

function isSecureCameraContext() {
  if (typeof window === "undefined") return false;
  return window.isSecureContext || ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function directionFromAzimuth(azimuth: number) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(azimuth / 45) % directions.length];
}

export default function ArSkyCalibration({
  active,
  orientation,
  aimTarget,
  nearbyTargets,
  lockedTarget,
  onActivateOrientation,
  onDeactivateOrientation,
  onActiveChange,
  onLockTarget,
  onSwitchToObservation,
  focusedConstellationName = null,
  launchRequest = 0,
  launcherVisible = true,
}: ArSkyCalibrationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastLaunchRequestRef = useRef(launchRequest);
  const [state, setState] = useState<CalibrationState>("idle");
  const [message, setMessage] = useState("");

  const stopMedia = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stop = useCallback(() => {
    stopMedia();
    onActiveChange(false);
    setState("idle");
    setMessage("");
  }, [onActiveChange, stopMedia]);

  useEffect(() => {
    return () => stopMedia();
  }, [stopMedia]);

  useEffect(() => {
    if (!active || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    void video.play().catch(() => {
      setMessage("摄像头画面未能自动播放，请点击页面后重试");
    });
  }, [active]);

  useEffect(() => {
    if (!active && streamRef.current) stopMedia();
  }, [active, stopMedia]);

  const start = useCallback(async () => {
    if (state === "requesting") return;
    setState("requesting");
    setMessage("");

    if (!isSecureCameraContext()) {
      setState("unsupported");
      setMessage("摄像头 AR 需要 HTTPS；localhost 可直接测试");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      setMessage("当前浏览器不支持摄像头访问");
      return;
    }

    try {
      const orientationGranted = await onActivateOrientation();
      if (!orientationGranted) {
        setState("denied");
        setMessage("方向传感器权限未获得，仍可使用普通观察模式");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      setState("active");
      onActiveChange(true);
    } catch (error) {
      stopMedia();
      onDeactivateOrientation();
      onActiveChange(false);
      setState("denied");
      setMessage(error instanceof DOMException && error.name === "NotAllowedError"
        ? "摄像头或方向传感器权限被拒绝，仍可使用普通观察模式"
        : "AR 启动失败，请确认浏览器允许摄像头并使用 HTTPS");
    }
  }, [onActivateOrientation, onActiveChange, onDeactivateOrientation, stopMedia]);

  useEffect(() => {
    if (launchRequest === lastLaunchRequestRef.current) return;
    lastLaunchRequestRef.current = launchRequest;
    void start();
  }, [launchRequest, start]);

  if (!active) {
    if (!launcherVisible) {
      return state === "denied" || state === "unsupported" ? (
        <div className="pointer-events-none absolute bottom-16 left-4 right-4 z-40 mx-auto max-w-xl rounded-md border border-amber-200/10 bg-black/70 px-3 py-2 text-center text-[11px] text-amber-100/70 backdrop-blur-md" role="status">
          {message}
        </div>
      ) : null;
    }
    return (
      <div className="absolute right-4 top-20 z-35 flex max-w-[min(22rem,calc(100vw-2rem))] flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => void start()}
          disabled={state === "requesting"}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-cyan-200/20 bg-black/35 px-3 py-2 text-xs text-cyan-100/75 shadow-lg shadow-black/20 backdrop-blur-md transition-colors hover:border-cyan-200/35 hover:bg-black/55 disabled:cursor-wait disabled:opacity-60"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7.5h3l1.4-2h7.2l1.4 2H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          {state === "requesting" ? "正在启动 AR..." : "AR 星空校准"}
        </button>
        {(state === "denied" || state === "unsupported") && (
          <div className="max-w-[18rem] rounded-lg border border-amber-200/10 bg-black/60 px-3 py-2 text-right text-[11px] leading-relaxed text-amber-100/60 backdrop-blur-md" role="status">
            {message}
          </div>
        )}
      </div>
    );
  }

  const heading = orientation ? Math.round(orientation.azimuth) : null;
  const direction = orientation ? directionFromAzimuth(orientation.azimuth) : "--";
  const reticleTarget = lockedTarget ?? aimTarget;

  return (
    <>
      <video
        ref={videoRef}
        className="pointer-events-none absolute inset-0 z-[5] h-full w-full object-cover opacity-70"
        style={{ filter: "brightness(0.82) contrast(1.12)" }}
        autoPlay
        muted
        playsInline
        aria-label="AR 星空摄像头画面"
      />
      <div className="pointer-events-none absolute inset-0 z-[25]">
        <div className={`absolute left-1/2 top-1/2 h-8 w-8 sm:h-9 sm:w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-colors duration-200 ${
          lockedTarget
            ? "border-emerald-200/90 shadow-[0_0_26px_rgba(110,231,183,0.28)]"
            : aimTarget
              ? "border-cyan-100/90 shadow-[0_0_26px_rgba(111,211,255,0.30)]"
              : "border-cyan-100/55 shadow-[0_0_24px_rgba(111,211,255,0.18)]"
        }`}>
          <span className="absolute left-1/2 top-[-5px] h-2.5 w-px -translate-x-1/2 bg-cyan-100/70" />
          <span className="absolute bottom-[-5px] left-1/2 h-2.5 w-px -translate-x-1/2 bg-cyan-100/70" />
          <span className="absolute left-[-5px] top-1/2 h-px w-2.5 -translate-y-1/2 bg-cyan-100/70" />
          <span className="absolute right-[-5px] top-1/2 h-px w-2.5 -translate-y-1/2 bg-cyan-100/70" />
        </div>
        {reticleTarget && (
          <div className="absolute left-1/2 top-[calc(50%+2.25rem)] -translate-x-1/2 whitespace-nowrap rounded-md bg-black/55 px-2 py-1 text-[11px] font-medium text-cyan-50/90 backdrop-blur-sm sm:top-[calc(50%+2.5rem)] sm:text-xs">
            {lockedTarget ? `已锁定 · ${reticleTarget.name}` : `捕捉到 · ${reticleTarget.name}`}
          </div>
        )}

        <div className="pointer-events-auto absolute left-4 right-4 top-20 z-30">
          <div className="max-w-[18rem] overflow-hidden rounded-lg border border-cyan-100/15 bg-black/45 px-3 py-2 text-[11px] text-cyan-50/75 backdrop-blur-md">
            <p className="font-medium text-cyan-50/90">AR 识星</p>
            <p className="mt-1 truncate text-cyan-50/55">
              {orientation ? `方向 ${direction} ${heading}° · 仰角 ${Math.round(orientation.pitch)}°` : "等待方向传感器..."}
            </p>
            {focusedConstellationName && (
              <p className="mt-1 truncate text-emerald-100/60">
                {focusedConstellationName} · 仅从成员星中确认
              </p>
            )}
          </div>
        </div>

        {nearbyTargets.length > 1 && !lockedTarget && (
          <div className="pointer-events-auto absolute bottom-28 left-4 right-4 mx-auto max-w-xl rounded-lg border border-cyan-100/15 bg-black/55 px-3 py-2 backdrop-blur-md">
            <div className="mb-1.5 text-[10px] text-cyan-50/45">准星附近的候选目标</div>
            <div className="flex flex-wrap gap-1.5">
              {nearbyTargets.map((target) => (
                <button
                  key={target.slug}
                  type="button"
                  onClick={() => onLockTarget(target)}
                  className="rounded-md border border-cyan-100/15 bg-cyan-100/[0.06] px-2.5 py-1 text-[11px] text-cyan-50/75 transition-colors hover:bg-cyan-100/[0.14]"
                >
                  {target.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pointer-events-auto absolute bottom-16 left-4 right-4 mx-auto flex max-w-xl items-center gap-2 rounded-lg border border-cyan-100/15 bg-black/55 px-3 py-2 text-[11px] text-cyan-50/70 backdrop-blur-md">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${lockedTarget ? "bg-emerald-300" : "bg-cyan-200"}`} />
            <span className="min-w-0 flex-1 truncate">
              {lockedTarget
                ? `已锁定 ${lockedTarget.name}`
                : aimTarget
                  ? `准星捕捉到 ${aimTarget.name}`
                  : "移动准星寻找命名星"}
            </span>
            {lockedTarget ? (
              <>
                <button
                  type="button"
                  onClick={() => onLockTarget(null)}
                  className="shrink-0 rounded-md px-2 py-1 text-white/40 transition-colors hover:text-white/70"
                >
                  重选
                </button>
                <button
                  type="button"
                  onClick={onSwitchToObservation}
                  className="shrink-0 rounded-md border border-emerald-200/25 bg-emerald-200/10 px-2.5 py-1.5 text-emerald-50/85 transition-colors hover:bg-emerald-200/15"
                >
                  切换观察模式
                </button>
              </>
            ) : aimTarget ? (
              <button
                type="button"
                onClick={() => onLockTarget(aimTarget)}
                className="shrink-0 rounded-md border border-cyan-200/25 bg-cyan-200/10 px-2.5 py-1.5 text-cyan-50/85 transition-colors hover:bg-cyan-200/15"
              >
                锁定
              </button>
            ) : null}
          </div>
      </div>
    </>
  );
}
