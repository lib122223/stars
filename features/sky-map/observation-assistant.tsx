"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildSecondCalibrationReferences,
  buildCalibrationReferences,
  computeObservationCalibration,
  refineObservationCalibration,
  type ObservationCalibration,
  type ObservationPose,
} from "@/lib/astronomy/observation-calibration";

interface ObservationAssistantProps {
  rawOrientation: ObservationPose | null;
  location: { lat: number; lng: number };
  obsTime: Date;
  calibration: ObservationCalibration | null;
  arActive: boolean;
  raised?: boolean;
  satelliteGuideVisible?: boolean;
  onActivateOrientation: () => Promise<boolean>;
  onCalibrationChange: (calibration: ObservationCalibration | null) => void;
  onRequestAr: () => void;
  onExitAr: () => void;
  onRequestCapture: () => void;
}

type PendingAction = "ar" | "capture" | null;

function directionFromAzimuth(azimuth: number) {
  const directions = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
  return directions[Math.round((((azimuth % 360) + 360) % 360) / 45) % directions.length];
}

function CrosshairIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="6" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7.5h3l1.4-2h7.2l1.4 2H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function ApertureIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8 4.9 4 7.1M19.8 9H12m4 10.1L12 12M4.2 15H12" />
    </svg>
  );
}

export default function ObservationAssistant({
  rawOrientation,
  location,
  obsTime,
  calibration,
  arActive,
  raised = false,
  satelliteGuideVisible = false,
  onActivateOrientation,
  onCalibrationChange,
  onRequestAr,
  onExitAr,
  onRequestCapture,
}: ObservationAssistantProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseRef = useRef(rawOrientation);
  const [open, setOpen] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [sampling, setSampling] = useState(false);
  const [selectedReferenceSlug, setSelectedReferenceSlug] = useState("");
  const [secondReferenceSlug, setSecondReferenceSlug] = useState("");
  const [firstCalibration, setFirstCalibration] = useState<ObservationCalibration | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [message, setMessage] = useState("");

  const references = useMemo(
    () => buildCalibrationReferences(obsTime, location),
    [location, obsTime],
  );
  const selectedReference = references.find((reference) => reference.slug === selectedReferenceSlug)
    ?? references[0]
    ?? null;
  const secondReferences = useMemo(
    () => selectedReference ? buildSecondCalibrationReferences(references, selectedReference) : [],
    [references, selectedReference],
  );
  const secondReference = secondReferences.find((reference) => reference.slug === secondReferenceSlug)
    ?? secondReferences[0]
    ?? null;

  useEffect(() => {
    poseRef.current = rawOrientation;
  }, [rawOrientation]);

  const stopCalibrationCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopCalibrationCamera(), [stopCalibrationCamera]);

  useEffect(() => {
    const releaseCamera = () => {
      stopCalibrationCamera();
      setCalibrating(false);
      setMessage("页面离开后已释放摄像头，请返回后重新开始校准。");
    };
    const releaseWhenHidden = () => {
      if (document.visibilityState === "hidden") releaseCamera();
    };

    document.addEventListener("visibilitychange", releaseWhenHidden);
    window.addEventListener("pagehide", releaseCamera);
    return () => {
      document.removeEventListener("visibilitychange", releaseWhenHidden);
      window.removeEventListener("pagehide", releaseCamera);
    };
  }, [stopCalibrationCamera]);

  useEffect(() => {
    if (!calibrating || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    void video.play().catch(() => setMessage("摄像头预览无法播放，请检查相机权限。"));
  }, [calibrating]);

  async function beginCalibration() {
    if (!selectedReference) {
      setMessage("当前没有位于地平线以上的月球或校准亮星。请稍后再试。 ");
      return;
    }
    setMessage("");
    setFirstCalibration(null);
    setSecondReferenceSlug("");
    if (arActive) onExitAr();
    const orientationGranted = await onActivateOrientation();
    if (!orientationGranted) {
      setMessage("没有获得手机方向权限，暂时不能计算方位和仰角偏移。 ");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("当前浏览器不支持网页摄像头，暂时不能进行视觉对准。 ");
      return;
    }
    try {
      stopCalibrationCamera();
      await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      setCalibrating(true);
      setPendingAction(null);
    } catch {
      setMessage("后置摄像头打开失败，请检查 HTTPS 和相机权限。 ");
    }
  }

  async function sampleCalibration() {
    const reference = firstCalibration ? secondReference : selectedReference;
    if (!reference || sampling) return;
    if (!poseRef.current) {
      setMessage("还没有收到手机方向数据，请保持页面打开后重试。 ");
      return;
    }
    setSampling(true);
    setMessage("");
    const samples: ObservationPose[] = [];
    for (let index = 0; index < 15; index += 1) {
      if (poseRef.current) samples.push({ ...poseRef.current });
      await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
    }
    try {
      if (samples.length === 0) {
        setMessage("采样期间没有收到方向数据，请保持页面打开并重试。");
        return;
      }
      const result = computeObservationCalibration({
        reference,
        samples,
        location,
      });
      if (result.sensorJitter > 5) {
        setMessage(`手机仍在晃动，当前波动约 ${result.sensorJitter.toFixed(1)}°，请稳定后重新采样。`);
        return;
      }
      if (!firstCalibration) {
        if (!secondReference) {
          onCalibrationChange(result);
          stopCalibrationCamera();
          setCalibrating(false);
          setMessage(`已使用${result.referenceName}完成基础校准，当前没有合适的第二参照天体。`);
          return;
        }
        setFirstCalibration(result);
        setSecondReferenceSlug(secondReference.slug);
        setMessage(`第一点已完成。请转向${secondReference.name}，它位于另一片天空，再把它放入准星完成验证。`);
        return;
      }

      const refined = refineObservationCalibration(firstCalibration, result);
      if (refined) {
        onCalibrationChange(refined);
        setMessage(`多星精校准完成，${firstCalibration.referenceName}与${result.referenceName}的偏移一致，预计误差 ±${Math.round(refined.estimatedAccuracy)}°。`);
      } else {
        onCalibrationChange(firstCalibration);
        setMessage(`两个校准点的偏移不一致，方位差或仰角差过大。已保留${firstCalibration.referenceName}的基础校准，请保持稳定后重试。`);
      }
      setFirstCalibration(null);
      stopCalibrationCamera();
      setCalibrating(false);
    } finally {
      setSampling(false);
    }
  }

  function cancelCalibration() {
    stopCalibrationCamera();
    setCalibrating(false);
    setSampling(false);
    setFirstCalibration(null);
    setSecondReferenceSlug("");
    setMessage("");
  }

  function runAction(action: Exclude<PendingAction, null>) {
    setOpen(false);
    setPendingAction(null);
    if (action === "ar") {
      onRequestAr();
      return;
    }
    if (arActive) {
      onExitAr();
      window.setTimeout(onRequestCapture, 160);
      return;
    }
    onRequestCapture();
  }

  function requestAction(action: Exclude<PendingAction, null>) {
    if (!calibration) {
      setPendingAction(action);
      return;
    }
    runAction(action);
  }

  const calibrationNames = calibration?.referenceNames?.join(" + ") ?? calibration?.referenceName;
  const calibrationMode = calibration?.mode === "refined" ? "多星精校准" : "基础校准";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setMessage(""); }}
        className={`pointer-events-auto fixed right-3 z-[38] inline-flex h-10 items-center gap-2 rounded-full border px-3 text-xs shadow-xl shadow-black/30 backdrop-blur-md transition-colors ${
          raised && !satelliteGuideVisible ? "bottom-48" : "bottom-[4.25rem]"
        } ${
          calibration
            ? "border-emerald-200/20 bg-[#0b1917]/85 text-emerald-50/80 hover:bg-[#10231f]/90"
            : "border-cyan-200/20 bg-[#0b151b]/85 text-cyan-50/75 hover:bg-[#10202a]/90"
        }`}
        style={{
          bottom: raised && !satelliteGuideVisible
            ? "calc(12rem + env(safe-area-inset-bottom))"
            : "calc(4.25rem + env(safe-area-inset-bottom))",
        }}
        aria-label="打开观测助手"
      >
        <CrosshairIcon />
        <span>{calibration ? `${calibrationMode} ±${Math.round(calibration.estimatedAccuracy)}°` : "观测助手"}</span>
      </button>
    );
  }

  return (
    <div
      className="pointer-events-auto fixed bottom-0 left-3 right-3 z-[45] mx-auto max-w-xl overflow-y-auto rounded-lg border border-white/12 bg-[#071219]/95 text-white/75 shadow-2xl shadow-black/45 backdrop-blur-xl"
      style={{
        bottom: "calc(4.25rem + env(safe-area-inset-bottom))",
        maxHeight: satelliteGuideVisible
          ? "calc(100dvh - 22rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))"
          : "calc(100dvh - 6rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
      }}
    >
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${calibration ? "bg-emerald-300" : "bg-amber-300"}`} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/90">观测助手</p>
            <p className="truncate text-[11px] text-white/40">
              {calibration
                ? `${calibrationNames} · ${calibrationMode} · 方位 ${calibration.azimuthOffset >= 0 ? "+" : ""}${calibration.azimuthOffset.toFixed(1)}° · 仰角 ${calibration.pitchOffset >= 0 ? "+" : ""}${calibration.pitchOffset.toFixed(1)}°`
                : "方向尚未校准"}
            </p>
          </div>
        </div>
        <button type="button" onClick={() => { cancelCalibration(); setOpen(false); }} className="h-8 w-8 text-xl leading-none text-white/35 transition-colors hover:text-white/70" aria-label="关闭观测助手">
          ×
        </button>
      </div>

      {calibrating && (firstCalibration ? secondReference : selectedReference) ? (
        <div className="p-3 sm:p-4">
          <div className="relative aspect-video overflow-hidden rounded-md bg-black">
            <video ref={videoRef} muted autoPlay playsInline className="h-full w-full object-cover" style={{ filter: "brightness(1.15) contrast(1.08)" }} />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/80 shadow-[0_0_24px_rgba(103,232,249,0.24)]">
              <span className="absolute left-1/2 top-[-6px] h-3 w-px -translate-x-1/2 bg-cyan-100/75" />
              <span className="absolute bottom-[-6px] left-1/2 h-3 w-px -translate-x-1/2 bg-cyan-100/75" />
              <span className="absolute left-[-6px] top-1/2 h-px w-3 -translate-y-1/2 bg-cyan-100/75" />
              <span className="absolute right-[-6px] top-1/2 h-px w-3 -translate-y-1/2 bg-cyan-100/75" />
            </div>
            <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[11px] text-cyan-50/85 backdrop-blur-sm">
              {(firstCalibration ? secondReference : selectedReference)!.name} · {directionFromAzimuth((firstCalibration ? secondReference : selectedReference)!.azimuth)} {Math.round((firstCalibration ? secondReference : selectedReference)!.azimuth)}° · 仰角 {Math.round((firstCalibration ? secondReference : selectedReference)!.altitude)}°
            </div>
          </div>
          {firstCalibration && secondReference && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-emerald-200/15 bg-emerald-200/[0.05] px-3 py-2 text-[11px] text-emerald-50/70">
              <span>第一点：{firstCalibration.referenceName} 已完成</span>
              {secondReferences.length > 1 && (
                <button type="button" onClick={() => {
                  const currentIndex = secondReferences.findIndex((reference) => reference.slug === secondReference.slug);
                  setSecondReferenceSlug(secondReferences[(currentIndex + 1) % secondReferences.length].slug);
                  setMessage("");
                }} disabled={sampling} className="shrink-0 text-cyan-100/75 hover:text-cyan-50 disabled:opacity-40">
                  换一个
                </button>
              )}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void sampleCalibration()} disabled={sampling || !rawOrientation} className="flex-1 rounded-md border border-cyan-200/25 bg-cyan-200/10 px-3 py-2.5 text-xs text-cyan-50/90 transition-colors hover:bg-cyan-200/15 disabled:cursor-wait disabled:opacity-45">
              {sampling ? "保持稳定 · 正在采样" : firstCalibration ? `已将${secondReference!.name}置于准星中心` : `已将${selectedReference!.name}置于准星中心`}
            </button>
            <button type="button" onClick={cancelCalibration} disabled={sampling} className="rounded-md px-3 py-2.5 text-xs text-white/45 transition-colors hover:text-white/70 disabled:opacity-40">
              取消
            </button>
          </div>
        </div>
      ) : pendingAction ? (
        <div className="p-4">
          <p className="text-sm text-white/85">当前方向尚未校准</p>
          <p className="mt-1 text-xs leading-relaxed text-white/45">继续使用时，星体方位和照片候选可能存在较大偏差。</p>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => void beginCalibration()} className="flex-1 rounded-md border border-cyan-200/25 bg-cyan-200/10 px-3 py-2.5 text-xs text-cyan-50/85">先校准</button>
            <button type="button" onClick={() => runAction(pendingAction)} className="rounded-md border border-white/10 px-3 py-2.5 text-xs text-white/50">继续使用</button>
          </div>
        </div>
      ) : (
        <div className="p-3 sm:p-4">
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => void beginCalibration()} className="flex min-h-[86px] flex-col items-center justify-center gap-1 rounded-md border border-white/10 bg-white/[0.035] px-2 text-center text-[11px] text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white/85">
              <CrosshairIcon />
              <span>{calibration ? "重新校准" : "系统校准"}</span>
              <span className="text-[10px] leading-tight text-white/35">用月球或亮星校正方向</span>
            </button>
            <button type="button" onClick={() => arActive ? onExitAr() : requestAction("ar")} className="flex min-h-[86px] flex-col items-center justify-center gap-1 rounded-md border border-white/10 bg-white/[0.035] px-2 text-center text-[11px] text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white/85">
              <CameraIcon />
              <span>{arActive ? "返回观察" : "AR 识星"}</span>
              <span className="text-[10px] leading-tight text-white/35">相机实时叠加星位</span>
            </button>
            <button type="button" onClick={() => requestAction("capture")} className="flex min-h-[86px] flex-col items-center justify-center gap-1 rounded-md border border-white/10 bg-white/[0.035] px-2 text-center text-[11px] text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white/85">
              <ApertureIcon />
              <span>拍摄识别</span>
              <span className="text-[10px] leading-tight text-white/35">增强照片并识别亮点</span>
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-white/[0.07] pt-3">
            <select
              aria-label="校准参照天体"
              value={selectedReference?.slug ?? ""}
              onChange={(event) => setSelectedReferenceSlug(event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2.5 py-2 text-xs text-white/65 outline-none"
            >
              {references.length === 0 && <option value="">当前没有可用参照</option>}
              {references.map((reference) => (
                <option key={reference.slug} value={reference.slug}>
                  {reference.name} · {directionFromAzimuth(reference.azimuth)} {Math.round(reference.azimuth)}° · {Math.round(reference.altitude)}°
                </option>
              ))}
            </select>
            {calibration && (
              <button type="button" onClick={() => onCalibrationChange(null)} className="shrink-0 px-2 py-2 text-[11px] text-white/35 transition-colors hover:text-white/65">
                清除
              </button>
            )}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-white/30">
            校准列表只显示当前仰角达到 8° 的真实可见天体。月球低于安全校准高度或尚未升起时会暂时隐藏，升起后会自动出现。
          </p>
        </div>
      )}

      {message && (
        <p className="border-t border-white/[0.07] px-4 py-2.5 text-[11px] text-amber-100/70" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
