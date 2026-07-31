"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { Body, Equator, Horizon, MakeTime, Observer } from "astronomy-engine";
import { activeBrightStars } from "@/lib/astronomy/bright-stars";
import {
  matchBrightPointsToSky,
  type NightSkyMatch,
  type NormalizedBrightPoint,
} from "@/lib/astronomy/night-photo-matching";
import type { ObservationCalibration } from "@/lib/astronomy/observation-calibration";
import {
  analyzeNightPhotoQuality,
  type NightPhotoQuality,
  type NightPhotoQualityReason,
} from "@/lib/astronomy/night-photo-quality";
import { stellarEquatorOfDate } from "@/lib/astronomy/stellar-coordinates";
import {
  areCandidatesTooClose,
  isCandidatePossible,
} from "@/lib/astronomy/candidate-visibility";
import type { PhotoArGuide } from "@/lib/astronomy/photo-ar-guide";
import { getConstellationForStar } from "@/lib/astronomy/constellations";

interface CaptureTarget {
  name: string;
  type: string;
  slug: string;
}

interface NightCaptureConfirmationProps {
  orientation: { azimuth: number; pitch: number } | null;
  location: { lat: number; lng: number };
  obsTime: Date;
  target: CaptureTarget | null;
  calibration: Pick<ObservationCalibration, "estimatedAccuracy" | "referenceName"> | null;
  launchRequest?: number;
  launcherVisible?: boolean;
  onPhotoGuideReady: (guide: PhotoArGuide) => void;
  onPhotoGuideClear: () => void;
  onRequestAr: () => void;
}

type Stage = "idle" | "guide" | "camera" | "processing" | "review" | "done";

type BrightPoint = NormalizedBrightPoint;
type Candidate = NightSkyMatch;

interface AchievementSummary {
  confirmedCount: number;
  uniqueTargetCount: number;
  nextGoal: number | null;
}

interface UnlockedSeries {
  slug: string;
  name: string;
  unlockedAt: string;
}

function directionFromAzimuth(azimuth: number) {
  const directions = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
  return directions[Math.round((((azimuth % 360) + 360) % 360) / 45) % directions.length];
}

const MAX_PROCESSING_WIDTH = 1280;
const BURST_FRAME_COUNT = 5;
const BURST_INTERVAL_MS = 120;
const MIN_POINT_SEPARATION = 0.02;
const QUALITY_WARNING_SCORE_MULTIPLIER = 0.82;

const qualityFeedback: Record<Exclude<NightPhotoQualityReason, "usable">, { title: string; detail: string }> = {
  underexposed: {
    title: "画面曝光不足",
    detail: "相机没有记录到足够亮的星点。请开启夜景或专业模式，适当增加曝光并稳定手机后重拍。",
  },
  light_interference: {
    title: "强光或过曝干扰",
    detail: "画面中存在大面积高亮区域。请避开路灯、窗户反光和车灯，并关闭闪光灯后重拍。",
  },
  bright_background: {
    title: "天空背景过亮",
    detail: "星点与天空的亮度差不足。请遮挡附近灯光、换一个方向，或等待天空更暗后重拍。",
  },
  cloud_or_haze: {
    title: "画面对比度过低",
    detail: "可能存在薄云、雾气或镜头起雾。请检查天空和镜头，等待云层移开后重拍。",
  },
  blurred: {
    title: "画面可能失焦或晃动",
    detail: "亮点边缘不够清晰。请擦拭镜头、固定手机，并将焦点调整到远处天空后重拍。",
  },
  no_star_points: {
    title: "没有检测到星点",
    detail: "照片中没有符合星点特征的局部亮点。请将目标放在画面中部，适当放大并重新拍摄。",
  },
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function readVideoFrame(video: HTMLVideoElement, zoom = 1): ImageData | null {
  if (video.videoWidth === 0 || video.videoHeight === 0) return null;
  const scale = Math.min(1, MAX_PROCESSING_WIDTH / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const safeZoom = Math.max(1, zoom);
  const sourceWidth = video.videoWidth / safeZoom;
  const sourceHeight = video.videoHeight / safeZoom;
  const sourceX = (video.videoWidth - sourceWidth) / 2;
  const sourceY = (video.videoHeight - sourceHeight) / 2;
  context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function frameNightQuality(frame: ImageData): number {
  const histogram = new Uint32Array(256);
  let luminanceSum = 0;
  const pixelCount = frame.data.length / 4;
  for (let index = 0; index < frame.data.length; index += 4) {
    const luminance = Math.round(
      (frame.data[index] + frame.data[index + 1] + frame.data[index + 2]) / 3,
    );
    histogram[luminance] += 1;
    luminanceSum += luminance;
  }

  const brightestSampleSize = Math.min(128, pixelCount);
  let brightestSum = 0;
  let brightestCount = 0;
  for (let luminance = 255; luminance >= 0 && brightestCount < brightestSampleSize; luminance -= 1) {
    const count = Math.min(histogram[luminance], brightestSampleSize - brightestCount);
    brightestSum += luminance * count;
    brightestCount += count;
  }
  const backgroundAverage = luminanceSum / Math.max(1, pixelCount);
  return brightestSum / Math.max(1, brightestCount) - backgroundAverage;
}

function bestNightFrame(frames: ImageData[]): ImageData {
  let best = frames[0];
  let bestQuality = frameNightQuality(best);
  for (let index = 1; index < frames.length; index += 1) {
    const quality = frameNightQuality(frames[index]);
    if (quality > bestQuality) {
      best = frames[index];
      bestQuality = quality;
    }
  }
  return best;
}

function imageDataToCanvas(frame: ImageData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return canvas;
  context.putImageData(frame, 0, 0);
  return canvas;
}

function enhanceNightImage(image: CanvasImageSource, width: number, height: number) {
  const scale = Math.min(1, MAX_PROCESSING_WIDTH / Math.max(1, width));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { canvas, width: canvas.width, height: canvas.height, originalPixels: new Uint8ClampedArray() };
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const originalPixels = new Uint8ClampedArray(imageData.data);
  let average = 0;
  for (let i = 0; i < imageData.data.length; i += 4) {
    average += (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
  }
  average /= Math.max(1, imageData.data.length / 4);
  const background = Math.min(55, average + 8);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const red = imageData.data[i];
    const green = imageData.data[i + 1];
    const blue = imageData.data[i + 2];
    const luminance = (red + green + blue) / 3;
    const normalized = Math.max(0, (luminance - background) / Math.max(1, 255 - background));
    const lifted = Math.min(255, Math.pow(normalized, 0.58) * 285);
    const gain = lifted / Math.max(1, luminance);
    imageData.data[i] = Math.min(255, red * gain);
    imageData.data[i + 1] = Math.min(255, green * gain);
    imageData.data[i + 2] = Math.min(255, blue * gain);
  }
  context.putImageData(imageData, 0, 0);
  return { canvas, width: canvas.width, height: canvas.height, originalPixels };
}

function detectBrightPoints(image: CanvasImageSource, width: number, height: number): BrightPoint[] {
  const canvas = document.createElement("canvas");
  const sampleWidth = Math.min(1024, width);
  const sampleHeight = Math.max(1, Math.round(height * sampleWidth / width));
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];
  context.drawImage(image, 0, 0, sampleWidth, sampleHeight);
  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const luminance = new Float32Array(sampleWidth * sampleHeight);
  let average = 0;
  for (let i = 0, p = 0; i < luminance.length; i += 1, p += 4) {
    luminance[i] = (pixels[p] + pixels[p + 1] + pixels[p + 2]) / 3;
    average += luminance[i];
  }
  average /= luminance.length;
  const threshold = Math.max(48, average + 14);
  const raw: BrightPoint[] = [];
  const backgroundOffsets = [
    [-5, -5], [0, -5], [5, -5],
    [-5, 0], [5, 0],
    [-5, 5], [0, 5], [5, 5],
  ];
  for (let y = 5; y < sampleHeight - 5; y += 1) {
    for (let x = 5; x < sampleWidth - 5; x += 1) {
      const value = luminance[y * sampleWidth + x];
      let background = 0;
      for (const [offsetX, offsetY] of backgroundOffsets) {
        background += luminance[(y + offsetY) * sampleWidth + x + offsetX];
      }
      const localBackground = background / backgroundOffsets.length;
      const contrast = value - localBackground;
      if (value < threshold && contrast < 14) continue;
      if (contrast < 8) continue;
      let localMaximum = true;
      for (let oy = -2; oy <= 2 && localMaximum; oy += 1) {
        for (let ox = -2; ox <= 2; ox += 1) {
          if (ox === 0 && oy === 0) continue;
          if (luminance[(y + oy) * sampleWidth + x + ox] > value) {
            localMaximum = false;
            break;
          }
        }
      }
      if (localMaximum) {
        raw.push({ x: x / sampleWidth, y: y / sampleHeight, brightness: value + contrast * 1.5 });
      }
    }
  }
  raw.sort((a, b) => b.brightness - a.brightness);
  const points: BrightPoint[] = [];
  for (const point of raw) {
    if (points.every((other) => Math.hypot(point.x - other.x, point.y - other.y) > MIN_POINT_SEPARATION)) {
      points.push(point);
    }
    if (points.length >= 64) break;
  }
  return points;
}

function mergeBrightPoints(...sets: BrightPoint[][]): BrightPoint[] {
  const merged = sets.flat().sort((a, b) => b.brightness - a.brightness);
  const points: BrightPoint[] = [];
  for (const point of merged) {
    if (points.every((other) => Math.hypot(point.x - other.x, point.y - other.y) > MIN_POINT_SEPARATION)) {
      points.push(point);
    }
    if (points.length >= 64) break;
  }
  return points;
}

function identifyCandidates(
  points: BrightPoint[],
  imageWidth: number,
  imageHeight: number,
  orientation: { azimuth: number; pitch: number },
  location: { lat: number; lng: number },
  obsTime: Date,
  calibration: Pick<ObservationCalibration, "estimatedAccuracy"> | null,
  zoom = 1,
): Candidate[] {
  if (points.length === 0) return [];
  const time = MakeTime(obsTime);
  const observer = new Observer(location.lat, location.lng, 0);
  const unique = new Map<string, ReturnType<typeof activeBrightStars>[number]>();
  for (const star of activeBrightStars()) unique.set(star.slug, star);
  const skyCandidates = [...unique.values()]
    .filter((star) => star.magnitude <= 3.8)
    .map((star) => {
      const eq = stellarEquatorOfDate(star.raHours, star.decDeg, obsTime);
      const horizontal = Horizon(time, observer, eq.ra, eq.dec);
      return {
        slug: star.slug,
        name: star.nameZh,
        magnitude: star.magnitude,
        azimuth: horizontal.azimuth,
        altitude: horizontal.altitude,
      };
    })
    .filter((star) => isCandidatePossible(star.altitude));

  return matchBrightPointsToSky(
    points,
    skyCandidates,
    orientation,
    { width: imageWidth, height: imageHeight },
    zoom,
    {
      calibrated: calibration != null,
      estimatedAccuracy: calibration?.estimatedAccuracy,
    },
  );
}

async function inspectImage(source: Blob | File, orientation: { azimuth: number; pitch: number } | null, location: { lat: number; lng: number }, obsTime: Date, calibration: Pick<ObservationCalibration, "estimatedAccuracy"> | null, zoom = 1) {
  let image: CanvasImageSource;
  let width = 0;
  let height = 0;
  let release = () => {};

  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(source);
    image = bitmap;
    width = bitmap.width;
    height = bitmap.height;
    release = () => bitmap.close();
  } else {
    const sourceUrl = URL.createObjectURL(source);
    const loadedImage = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("无法读取照片"));
      element.src = sourceUrl;
    });
    image = loadedImage;
    width = loadedImage.naturalWidth;
    height = loadedImage.naturalHeight;
    release = () => URL.revokeObjectURL(sourceUrl);
  }

  const enhanced = enhanceNightImage(image, width, height);
  const points = mergeBrightPoints(
    detectBrightPoints(image, width, height),
    detectBrightPoints(enhanced.canvas, enhanced.width, enhanced.height),
  );
  const quality = analyzeNightPhotoQuality(
    enhanced.originalPixels,
    enhanced.width,
    enhanced.height,
    points.length,
  );
  let candidates = orientation && quality.usable
    ? identifyCandidates(points, enhanced.width, enhanced.height, orientation, location, obsTime, calibration, zoom)
    : [];
  if (quality.warning) {
    candidates = candidates.map((candidate) => ({
      ...candidate,
      score: candidate.score * QUALITY_WARNING_SCORE_MULTIPLIER,
    }));
  }
  const previewUrl = enhanced.canvas.toDataURL("image/jpeg", 0.9);
  release();
  return {
    previewUrl,
    points,
    candidates,
    quality,
    imageWidth: enhanced.width,
    imageHeight: enhanced.height,
    zoom,
  };
}

function observationTargetName(candidate: Candidate) {
  const constellation = getConstellationForStar(candidate.slug);
  return constellation ? `${constellation.nameZh} · ${candidate.name}` : candidate.name;
}

export default function NightCaptureConfirmation({
  orientation,
  location,
  obsTime,
  target,
  calibration,
  launchRequest = 0,
  launcherVisible = true,
  onPhotoGuideReady,
  onPhotoGuideClear,
  onRequestAr,
}: NightCaptureConfirmationProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastLaunchRequestRef = useRef(launchRequest);
  const [stage, setStage] = useState<Stage>("idle");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [brightPoints, setBrightPoints] = useState<BrightPoint[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [photoQuality, setPhotoQuality] = useState<NightPhotoQuality | null>(null);
  const [photoAnalysis, setPhotoAnalysis] = useState<{
    imageWidth: number;
    imageHeight: number;
    zoom: number;
  } | null>(null);
  const [selectedPhotoPoint, setSelectedPhotoPoint] = useState<BrightPoint | null>(null);
  const [message, setMessage] = useState("");
  const [burstProgress, setBurstProgress] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [cameraZoom, setCameraZoom] = useState(1);
  const [confirmingSlug, setConfirmingSlug] = useState<string | null>(null);
  const [confirmedCandidate, setConfirmedCandidate] = useState<Candidate | null>(null);
  const [achievement, setAchievement] = useState<AchievementSummary | null>(null);
  const [newlyUnlocked, setNewlyUnlocked] = useState<UnlockedSeries[]>([]);
  const [capture, setCapture] = useState<{ capturedAt: string; azimuth: number | null; pitch: number | null; lat: number; lng: number; target: CaptureTarget | null } | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => {
    stopCamera();
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl, stopCamera]);

  useEffect(() => {
    const releaseCamera = () => {
      stopCamera();
      setCapturing(false);
      setStage((current) => current === "camera" || current === "processing" ? "guide" : current);
      setMessage("页面离开后已释放摄像头，请返回后重新打开拍摄。");
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
  }, [stopCamera]);

  useEffect(() => {
    if (stage !== "camera" || !streamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    const play = () => {
      void video.play().catch(() => setMessage("相机预览无法播放，请检查浏览器的相机权限。"));
    };
    video.addEventListener("loadedmetadata", play);
    play();
    return () => video.removeEventListener("loadedmetadata", play);
  }, [stage]);

  const start = useCallback(() => {
    onPhotoGuideClear();
    setCapture({ capturedAt: new Date().toISOString(), azimuth: orientation?.azimuth ?? null, pitch: orientation?.pitch ?? null, lat: location.lat, lng: location.lng, target });
    setMessage(orientation ? "" : "当前没有方向传感器数据；仍可拍摄或上传，但无法可靠判断具体星名。");
    setStage("guide");
  }, [location.lat, location.lng, onPhotoGuideClear, orientation, target]);

  useEffect(() => {
    if (launchRequest === lastLaunchRequestRef.current) return;
    lastLaunchRequestRef.current = launchRequest;
    start();
  }, [launchRequest, start]);

  function handlePhotoPointSelect(event: MouseEvent<HTMLImageElement>) {
    if (!photoAnalysis) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const point = {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
      brightness: 1,
    } satisfies BrightPoint;
    setSelectedPhotoPoint(point);

    if (!capture || capture.azimuth == null || capture.pitch == null) {
      setMessage("已选择照片位置，但缺少拍摄时的方向和仰角，无法匹配具体星名。请允许方向传感器后重拍。");
      return;
    }

    const nextCandidates = identifyCandidates(
      [point],
      photoAnalysis.imageWidth,
      photoAnalysis.imageHeight,
      { azimuth: capture.azimuth, pitch: capture.pitch },
      location,
      new Date(capture.capturedAt),
      calibration,
      photoAnalysis.zoom,
    );
    setCandidates(nextCandidates);
    setMessage(nextCandidates.length > 0
      ? "已按你选择的亮点重新匹配，请确认实际看到的星星。"
      : "已选择这个位置，但没有匹配到符合当前时间和方向的星星，请换一个亮点位置。");
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("当前浏览器不支持网页相机，请使用上传照片。");
      inputRef.current?.click();
      return;
    }
    try {
      stopCamera();
      await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
      let stream: MediaStream | null = null;
      let lastError: unknown = null;
      const constraints: MediaStreamConstraints[] = [
        { audio: false, video: { facingMode: { exact: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
        { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      ];
      for (const constraint of constraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraint);
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!stream) throw lastError ?? new Error("camera unavailable");
      streamRef.current = stream;
      setMessage("");
      setStage("camera");
    } catch {
      setMessage("后置相机打开失败，请检查 HTTPS 和相机权限，或直接上传照片。");
      inputRef.current?.click();
    }
  }

  async function captureFrame() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || !capture) return;
    if (capturing) return;
    const captureZoom = cameraZoom;
    const capturedAt = new Date().toISOString();
    const captureOrientation = orientation ?? (capture.azimuth != null && capture.pitch != null
      ? { azimuth: capture.azimuth, pitch: capture.pitch }
      : null);
    setCapturing(true);
    setBurstProgress(0);
    try {
      const frames: ImageData[] = [];
      for (let index = 0; index < BURST_FRAME_COUNT; index += 1) {
        const frame = readVideoFrame(video, captureZoom);
        if (frame) frames.push(frame);
        setBurstProgress(index + 1);
        if (index < BURST_FRAME_COUNT - 1) await sleep(BURST_INTERVAL_MS);
      }
      if (frames.length === 0) throw new Error("no frame");
      const selectedFrame = imageDataToCanvas(bestNightFrame(frames));
      const blob = await new Promise<Blob | null>((resolve) => selectedFrame.toBlob(resolve, "image/jpeg", 0.94));
      if (!blob) throw new Error("unable to encode frame");
      stopCamera();
      setStage("processing");
      const result = await inspectImage(blob, captureOrientation, location, obsTime, calibration, captureZoom);
      if (captureOrientation) {
        setCapture((previous) => previous ? { ...previous, capturedAt, azimuth: captureOrientation.azimuth, pitch: captureOrientation.pitch } : previous);
      }
      setPhotoUrl(result.previewUrl);
      setBrightPoints(result.points);
      setCandidates(result.candidates);
      setPhotoQuality(result.quality);
      setPhotoAnalysis({ imageWidth: result.imageWidth, imageHeight: result.imageHeight, zoom: result.zoom });
      setPhotoName(`网页夜景多帧择优-${captureZoom.toFixed(1)}x.jpg`);
      setStage("review");
    } catch {
      stopCamera();
      setMessage("照片读取或亮点分析失败，请重新拍摄或上传 JPG、PNG 照片。");
      setStage("guide");
    } finally {
      setCapturing(false);
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    onPhotoGuideClear();
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setStage("processing");
    try {
      const result = await inspectImage(file, orientation, location, obsTime, calibration);
      if (orientation) {
        setCapture((previous) => previous ? { ...previous, capturedAt: new Date().toISOString(), azimuth: orientation.azimuth, pitch: orientation.pitch } : previous);
      }
      setPhotoUrl(result.previewUrl);
      setBrightPoints(result.points);
      setCandidates(result.candidates);
      setPhotoQuality(result.quality);
      setPhotoAnalysis({ imageWidth: result.imageWidth, imageHeight: result.imageHeight, zoom: result.zoom });
      setPhotoName(file.name);
      setStage("review");
    } catch {
      setMessage("照片读取或亮点分析失败，请选择有效的 JPG、PNG 照片。");
      setStage("guide");
    }
  }

  async function confirmCandidate(candidate: Candidate) {
    if (confirmingSlug) return;
    setConfirmingSlug(candidate.slug);
    setMessage("");
    try {
      const response = await fetch("/api/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetName: observationTargetName(candidate),
          targetSlug: candidate.slug,
          objectType: "bright_star",
          observedAt: capture?.capturedAt ?? new Date().toISOString(),
          latitude: capture?.lat ?? location.lat,
          longitude: capture?.lng ?? location.lng,
          equipment: "网页夜景识别",
          notes: `照片检测到 ${brightPoints.length} 个亮点，候选匹配分数 ${Math.round(candidate.score * 100)}%。`,
          confirmed: true,
        }),
      });
      const json = await response.json();
      if (!response.ok || json.code !== 0) throw new Error(json.message || "observation confirmation failed");
      setNewlyUnlocked((json.data?.newlyUnlocked as UnlockedSeries[] | undefined) ?? []);

      const achievementResponse = await fetch("/api/achievements", { cache: "no-store" });
      const achievementJson = await achievementResponse.json();
      if (achievementResponse.ok && achievementJson.code === 0) {
        setAchievement(achievementJson.data as AchievementSummary);
      }
      if (capture?.azimuth != null && capture.pitch != null && photoAnalysis) {
        onPhotoGuideReady({
          id: `${candidate.slug}:${capture.capturedAt}`,
          target: {
            name: candidate.name,
            type: "bright_star",
            slug: candidate.slug,
          },
          pointX: candidate.pointX,
          pointY: candidate.pointY,
          imageWidth: photoAnalysis.imageWidth,
          imageHeight: photoAnalysis.imageHeight,
          zoom: photoAnalysis.zoom,
          capturedAt: capture.capturedAt,
          captureAzimuth: capture.azimuth,
          capturePitch: capture.pitch,
          targetAzimuth: candidate.azimuth,
          targetAltitude: candidate.altitude,
        });
      }
      setConfirmedCandidate(candidate);
      setStage("done");
    } catch {
      setMessage("确认观测失败，请检查记录服务或数据库连接后重试。");
    } finally {
      setConfirmingSlug(null);
    }
  }

  function reset(clearPhotoGuide = true) {
    stopCamera();
    if (clearPhotoGuide) onPhotoGuideClear();
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    setBrightPoints([]);
    setCandidates([]);
    setPhotoQuality(null);
    setPhotoAnalysis(null);
    setSelectedPhotoPoint(null);
    setPhotoName("");
    setCapture(null);
    setMessage("");
    setBurstProgress(0);
    setCapturing(false);
    setCameraZoom(1);
    setConfirmingSlug(null);
    setConfirmedCandidate(null);
    setAchievement(null);
    setNewlyUnlocked([]);
    setStage("idle");
  }

  if (stage === "idle") {
    return <div className={launcherVisible ? "pointer-events-auto absolute left-4 top-20 z-35" : "hidden"}>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => void handleUpload(event)} />
      {launcherVisible && <button type="button" onClick={start} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/55 px-3 py-2 text-xs text-white/70 shadow-lg shadow-black/20 backdrop-blur-md hover:bg-black/70"><span aria-hidden="true">◉</span>夜景拍摄识别</button>}
      {message && <p className="mt-2 max-w-[16rem] rounded-lg bg-black/65 px-3 py-2 text-right text-[11px] text-amber-100/75">{message}</p>}
    </div>;
  }

  const failedQuality = photoQuality && photoQuality.reason !== "usable"
    ? qualityFeedback[photoQuality.reason]
    : capture?.azimuth == null || capture?.pitch == null
      ? {
          title: "没有记录拍摄方向",
          detail: "照片中可能存在亮点，但缺少快门时刻的方位和仰角，无法可靠缩小候选范围。请允许方向传感器后重拍。",
        }
      : {
          title: "星点与当前方向不匹配",
          detail: "照片检测到了亮点，但没有天体同时满足照片位置、方位和仰角条件。请确认校准状态并重新对准目标。",
        };
  const qualityWarning = photoQuality?.warning
    ? qualityFeedback[photoQuality.warning]
    : null;
  const crowdedCandidateSlugs = new Set<string>();
  for (let firstIndex = 0; firstIndex < candidates.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < candidates.length; secondIndex += 1) {
      const first = candidates[firstIndex];
      const second = candidates[secondIndex];
      if (areCandidatesTooClose(first, second)) {
        crowdedCandidateSlugs.add(first.slug);
        crowdedCandidateSlugs.add(second.slug);
      }
    }
  }
  const crowdedCandidates = candidates.filter((candidate) => crowdedCandidateSlugs.has(candidate.slug));

  return <div className="pointer-events-auto absolute left-4 right-4 top-20 z-40 mx-auto max-w-xl rounded-2xl border border-white/15 bg-[#07121b]/95 p-4 text-white/75 shadow-2xl shadow-black/40 backdrop-blur-xl">
    <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => void handleUpload(event)} />
    {stage === "guide" && <>
      <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-white/90">拍摄星空照片</p><p className="mt-1 text-xs leading-relaxed text-white/50">系统会记录目标、时间、地点、方向和仰角。打开后置相机后，可使用手机系统的夜景或专业模式。</p></div><button type="button" onClick={() => reset()} className="text-xs text-white/35">取消</button></div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/55"><span>目标：{capture?.target?.name ?? "未选择"}</span><span>方向：{capture?.azimuth != null ? `${directionFromAzimuth(capture.azimuth)} ${Math.round(capture.azimuth)}°` : "未记录"}</span><span>仰角：{capture?.pitch != null ? `${Math.round(capture.pitch)}°` : "未记录"}</span><span>位置：{capture ? `${capture.lat.toFixed(2)}°, ${capture.lng.toFixed(2)}°` : "--"}</span></div>
      <p className="mt-3 rounded-lg border border-cyan-100/10 bg-cyan-100/[0.04] px-3 py-2 text-[11px] leading-relaxed text-cyan-50/65">使用后置摄像头，关闭闪光灯，避开路灯。建议开启系统相机的夜景或专业模式。</p>
       <div className="mt-3 grid gap-2 sm:grid-cols-2">
         <button type="button" onClick={() => void openCamera()} className="rounded-lg border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs text-cyan-50/85">打开后置相机</button>
         <Link href="/tools/device-simulator?mode=camera&returnTo=%2Fsky-map%3Fmode%3Dobserve" className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-center text-xs text-white/60 hover:bg-white/[0.08] hover:text-white/80">相机设置助手</Link>
       </div>
    </>}
    {stage === "camera" && <><div className="overflow-hidden rounded-lg bg-black"><video ref={videoRef} muted autoPlay playsInline className="max-h-64 w-full object-contain transition-transform duration-150" style={{ filter: "brightness(1.28) contrast(1.08)", transform: `scale(${cameraZoom})` }} /></div><div className="mt-3 flex items-center gap-2"><span className="shrink-0 text-[11px] text-white/45">放大 {cameraZoom.toFixed(1)}×</span><input aria-label="相机放大倍率" type="range" min="1" max="3" step="0.1" value={cameraZoom} onChange={(event) => setCameraZoom(Number(event.target.value))} disabled={capturing} className="min-w-0 flex-1 accent-cyan-200" /></div><div className="mt-3 flex gap-2"><button type="button" disabled={capturing} onClick={() => void captureFrame()} className="flex-1 rounded-lg border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs text-cyan-50/85 disabled:cursor-wait disabled:opacity-60">{capturing ? `正在采集 ${burstProgress}/${BURST_FRAME_COUNT} 帧` : "拍摄并识别"}</button><button type="button" disabled={capturing} onClick={() => reset()} className="rounded-lg px-3 py-2 text-xs text-white/45 disabled:opacity-40">取消</button></div></>}
    {stage === "processing" && <div className="py-5 text-center"><p className="text-sm text-white/80">正在处理夜景照片</p><p className="mt-1 text-xs text-white/45">正在进行多帧择优、增亮、降噪和星点匹配。</p></div>}
    {stage === "review" && <>
      <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-white/90">识别结果</p><p className="mt-1 text-[11px] text-white/45">{photoName}</p></div><button type="button" onClick={() => reset()} className="text-xs text-white/35">重新拍摄</button></div>
      {photoUrl && <div className="relative mx-auto mt-3 w-fit max-w-full overflow-hidden rounded-lg bg-black/35">
        <img
          src={photoUrl}
          alt="星空照片预览，点击选择目标亮点"
          className="block max-h-48 max-w-full cursor-crosshair object-contain"
          onClick={handlePhotoPointSelect}
        />
        {selectedPhotoPoint && <span
          className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.5)]"
          style={{ left: `${selectedPhotoPoint.x * 100}%`, top: `${selectedPhotoPoint.y * 100}%` }}
          aria-hidden="true"
        />}
      </div>}
      <p className="mt-2 text-[10px] text-white/35">点击照片中的目标亮点，可按手动位置重新匹配</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/55"><span>检测亮点：{brightPoints.length}</span><span>方向：{capture?.azimuth != null ? `${directionFromAzimuth(capture.azimuth)} ${Math.round(capture.azimuth)}°` : "未记录"}</span><span>仰角：{capture?.pitch != null ? `${Math.round(capture.pitch)}°` : "未记录"}</span><span>目标：{capture?.target?.name ?? target?.name ?? "未选择"}</span><span className="col-span-2">识别尺度：{calibration ? `${calibration.referenceName}校准 · 预计 ±${Math.round(calibration.estimatedAccuracy)}°` : "未校准 · 宽松匹配"}</span></div>
      {candidates.length > 0 && qualityWarning && <div className="mt-3 rounded-lg border border-amber-100/15 bg-amber-100/[0.05] px-3 py-2"><p className="text-xs font-medium text-amber-50/80">{qualityWarning.title}</p><p className="mt-1 text-[11px] leading-relaxed text-amber-50/55">{qualityWarning.detail} 当前候选匹配度已降低。</p></div>}
      {crowdedCandidates.length > 1 && <div className="mt-3 rounded-lg border border-amber-100/15 bg-amber-100/[0.05] px-3 py-2"><p className="text-xs font-medium text-amber-50/85">检测到近邻候选</p><p className="mt-1 text-[11px] leading-relaxed text-amber-50/60">这些目标在真实天空中的角距离很小，系统已按拍摄时间、经纬度和地平线过滤不可能的候选；剩余目标需要你确认实际看到的是哪一个。</p></div>}
      {candidates.length > 0 ? <div className="mt-3 space-y-1.5"><p className="text-[11px] text-emerald-100/70">疑似星星：选择你实际观测到的目标</p>{candidates.map((candidate) => <div key={candidate.slug} className="flex items-center justify-between gap-3 rounded-lg border border-emerald-100/10 bg-emerald-100/[0.04] px-3 py-2 text-xs"><span>{candidate.name}<span className="ml-2 text-emerald-100/45">匹配度 {Math.round(candidate.score * 100)}%</span><span className="mt-0.5 block text-[10px] text-white/35">{directionFromAzimuth(candidate.azimuth)} {Math.round(candidate.azimuth)}° · 仰角 {Math.round(candidate.altitude)}°</span><span className="mt-0.5 block text-[10px] text-white/30">照片方位误差 {candidate.azimuthError.toFixed(1)}° · 照片仰角误差 {candidate.altitudeError.toFixed(1)}° · {candidate.calibrated ? "已校准" : "未校准"}</span></span><button type="button" disabled={confirmingSlug != null} onClick={() => void confirmCandidate(candidate)} className="shrink-0 rounded-md border border-emerald-200/20 bg-emerald-200/10 px-2 py-1 text-[11px] text-emerald-50/80 disabled:cursor-wait disabled:opacity-50">{confirmingSlug === candidate.slug ? "确认中…" : "确认观测"}</button></div>)}</div> : <div className="mt-3 rounded-lg border border-amber-100/15 bg-amber-100/[0.05] px-3 py-3"><p className="text-xs font-medium text-amber-50/85">{failedQuality.title}</p><p className="mt-1 text-[11px] leading-relaxed text-amber-50/60">{failedQuality.detail}</p><p className="mt-2 text-[10px] text-white/30">当前照片不会生成候选，也不会计入观测成就。</p></div>}
      <p className="mt-3 text-[10px] leading-relaxed text-white/35">疑似结果只提供候选，不会增加成就；只有点击“确认观测”并成功保存记录后，才会计入已确认目标。</p>
      {message && <p className="mt-3 text-xs text-amber-100/70" role="status">{message}</p>}
    </>}
    {stage === "done" && <div><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-emerald-50/90">已确认观测 · {confirmedCandidate?.name}</p><p className="mt-1 text-[11px] text-white/45">这次观测已经计入成就进度。</p>{newlyUnlocked.length > 0 && <p className="mt-2 text-sm font-medium text-amber-100/85">新徽章 · {newlyUnlocked.map((series) => series.name).join("、")}</p>}{achievement && <p className="mt-2 text-xs text-emerald-100/70">已确认 {achievement.uniqueTargetCount} 个目标 · 共 {achievement.confirmedCount} 次</p>}{achievement?.nextGoal && <p className="mt-1 text-[11px] text-white/40">距离下一阶段还需确认 {achievement.nextGoal - achievement.uniqueTargetCount} 个新目标</p>}</div><button type="button" onClick={() => reset()} className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/55">完成</button></div><button type="button" onClick={() => { onRequestAr(); reset(false); }} className="mt-3 w-full rounded-lg border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs text-cyan-50/85">用 AR 寻找 {confirmedCandidate?.name}</button><Link href="/achievements" className="mt-3 inline-flex text-xs text-accent/75 hover:text-accent">查看任务和徽章</Link></div>}
  </div>;
}
