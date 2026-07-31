"use client";

import { useState, useCallback, useEffect, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import BottomDrawer from "@/features/sky-map/bottom-drawer";
import SearchBar from "@/features/sky-map/search-bar";
import type { OrientationStatus } from "@/features/sky-map/orientation-toggle";
import ArSkyCalibration from "@/features/sky-map/ar-sky-calibration";
import { resolveTimeContext, type TimeContextKey } from "@/lib/time-context";
import StarCanvas from "@/features/sky-map/star-canvas";
import SatellitePassGuide, { type SatelliteGuidePass } from "@/features/sky-map/satellite-pass-guide";
import NightCaptureConfirmation from "@/features/sky-map/night-capture-confirmation";
import ObservationAssistant from "@/features/sky-map/observation-assistant";
import AchievementTaskStrip, { getActiveAchievementTask } from "@/features/sky-map/achievement-task-strip";
import type { AchievementCenterData } from "@/lib/achievements/types";
import { Horizon, Observer, MakeTime, Body, Equator } from "astronomy-engine";
import { findBrightStar } from "@/lib/astronomy/bright-stars";
import { getLocalAstronomyCatalog } from "@/lib/astronomy/catalog";
import type { AstronomyCatalog } from "@/lib/astronomy/catalog-types";
import type { PhotoArGuide } from "@/lib/astronomy/photo-ar-guide";
import { stellarEquatorOfDate } from "@/lib/astronomy/stellar-coordinates";
import {
  applyObservationCalibration,
  isObservationCalibrationValid,
  type ObservationCalibration,
  type ObservationPose,
} from "@/lib/astronomy/observation-calibration";

const WWTViewer = dynamic(
  () => import("@/features/sky-map/wwt-viewer"),
  { ssr: false },
);

interface ObjectContent {
  name: string;
  type: string;
  slug: string;
  isPreviewOnly?: boolean;
}

/** target slug → 引导态文案映射 */
const targetGuide: Record<string, { target: string; reason: string }> = {
  jupiter: {
    target: "木星",
    reason: "首页推荐，当前亮度高，位置明显，适合新手先认。",
  },
  moon: {
    target: "月球",
    reason: "首页推荐，今晚最容易观测的目标，新手最好的起点。",
  },
  vega: {
    target: "织女星",
    reason: "首页推荐，夏季大三角中最亮的一颗，容易先抓住一个点。",
  },
  venus: { target: "金星", reason: "当前亮度最高，是夜空中最显眼的天体之一。" },
  mars: { target: "火星", reason: "橙红色光芒，辨识度极高。" },
  saturn: { target: "土星", reason: "淡黄色光芒，适合作为长期跟踪目标。" },
  sirius: { target: "天狼星", reason: "夜空中最亮的恒星。" },
  polaris: { target: "北极星", reason: "几乎不动，是辨认方向的天然锚点。" },
  betelgeuse: { target: "参宿四", reason: "橙红色超巨星，颜色鲜明易辨。" },
  orion: { target: "猎户座", reason: "冬季夜空最易辨认的星座，以腰带三星为标志。" },
  "brightest-visible-target": {
    target: "木星",
    reason: "通用推荐，今晚最明亮的目标，最适合作为观星起点。",
  },
  "bright-star-entry": {
    target: "天狼星",
    reason: "通用推荐，夜空中最亮的恒星，即使城市里也很容易看到。",
  },
};

const defaultGuide = {
  target: "今晚的夜空",
  reason: "真实星图引擎，可按时间地点展示当前可观测的天区。",
};

// 时间偏移规则 — 阶段 8 时间控制复用
const TIME_OFFSET_MIN = -720;
const TIME_OFFSET_MAX = 720;
const TIME_STEP_MINUTES = 10;
const clampOffset = (v: number) => Math.max(TIME_OFFSET_MIN, Math.min(TIME_OFFSET_MAX, v));
const angleDelta = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const signedAngleDelta = (a: number, b: number) => ((a - b + 540) % 360) - 180;
const degToRad = (deg: number) => (deg * Math.PI) / 180;
const radToDeg = (rad: number) => (rad * 180) / Math.PI;
const normalizeDeg = (deg: number) => ((deg % 360) + 360) % 360;
const OBSERVATION_CALIBRATION_STORAGE_KEY = "eop.observation-calibration.v1";

const planetBody: Record<string, Body> = {
  jupiter: Body.Jupiter,
  venus: Body.Venus,
  mars: Body.Mars,
  saturn: Body.Saturn,
  moon: Body.Moon,
};

function computeAlt(
  slug: string,
  type: string,
  time: Date,
  location: { lat: number; lng: number },
): number | null {
  try {
    const t = MakeTime(time);
    const obs = new Observer(location.lat, location.lng, 0);
    if (type === "planet" && planetBody[slug]) {
      const eq = Equator(planetBody[slug], t, obs, true, true);
      return Horizon(t, obs, eq.ra, eq.dec).altitude;
    }
    if (type === "bright_star") {
      const star = findBrightStar(slug);
      if (!star) return null;
      const eq = stellarEquatorOfDate(star.raHours, star.decDeg, time);
      return Horizon(t, obs, eq.ra, eq.dec).altitude;
    }
    return null;
  } catch {
    return null;
  }
}

function computeDeviceSkyPose(e: DeviceOrientationEvent): { azimuth: number; pitch: number; gamma: number } | null {
  if (e.beta == null || e.gamma == null) return null;

  const compassHeading = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
  const alphaForMatrix = compassHeading != null
    ? normalizeDeg(360 - compassHeading)
    : e.alpha != null
      ? normalizeDeg(e.alpha)
      : null;

  if (alphaForMatrix == null) return null;

  const alpha = degToRad(alphaForMatrix);
  const beta = degToRad(e.beta);
  const gamma = degToRad(e.gamma);

  const cA = Math.cos(alpha);
  const sA = Math.sin(alpha);
  const cB = Math.cos(beta);
  const sB = Math.sin(beta);
  const cG = Math.cos(gamma);
  const sG = Math.sin(gamma);

  const screenNormalEast = cA * sG + cG * sA * sB;
  const screenNormalNorth = sA * sG - cA * cG * sB;
  const screenNormalUp = cB * cG;

  const viewEast = -screenNormalEast;
  const viewNorth = -screenNormalNorth;
  const viewUp = -screenNormalUp;
  const horizontal = Math.hypot(viewEast, viewNorth);

  const azimuth = horizontal < 0.001
    ? (compassHeading != null ? compassHeading : normalizeDeg(360 - alphaForMatrix))
    : normalizeDeg(radToDeg(Math.atan2(viewEast, viewNorth)));
  const pitch = radToDeg(Math.atan2(viewUp, horizontal));

  return {
    azimuth,
    pitch: Math.max(-45, Math.min(90, pitch)),
    gamma: e.gamma,
  };
}

function readPoseParam(value: string | null, min: number, max: number): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : null;
}

function getObjectStatus(
  slug: string,
  type: string,
  obsTime: Date,
  obsLocation: { lat: number; lng: number },
): string | null {
  const alt = computeAlt(slug, type, obsTime, obsLocation);
  if (alt == null) return null;
  return alt > 0 ? "当前可见" : "已落下";
}

function getBestTime(
  slug: string,
  type: string,
  baseTime: Date,
  viewTime: Date,
  obsLocation: { lat: number; lng: number },
): string | null {
  const currentAlt = computeAlt(slug, type, viewTime, obsLocation);
  if (currentAlt == null || currentAlt <= 0) return null;
  let bestTime: Date | null = null;
  let bestAlt = currentAlt;
  for (let offset = TIME_OFFSET_MIN; offset <= TIME_OFFSET_MAX; offset += TIME_STEP_MINUTES) {
    const t = new Date(baseTime.getTime() + offset * 60000);
    const alt = computeAlt(slug, type, t, obsLocation);
    if (alt != null && alt > bestAlt) { bestAlt = alt; bestTime = t; }
  }
  if (!bestTime) return null;
  const diffMin = (bestTime.getTime() - viewTime.getTime()) / 60000;
  if (bestAlt - currentAlt < 10 || Math.abs(diffMin) < 30) return null;
  const label = bestTime.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  return `最佳时段 ${label}`;
}

function isNearBestTime(
  slug: string,
  type: string,
  baseTime: Date,
  viewTime: Date,
  obsLocation: { lat: number; lng: number },
): boolean {
  const currentAlt = computeAlt(slug, type, viewTime, obsLocation);
  if (currentAlt == null || currentAlt <= 0) return false;
  let bestTime: Date | null = null;
  let bestAlt = currentAlt;
  for (let offset = TIME_OFFSET_MIN; offset <= TIME_OFFSET_MAX; offset += TIME_STEP_MINUTES) {
    const t = new Date(baseTime.getTime() + offset * 60000);
    const alt = computeAlt(slug, type, t, obsLocation);
    if (alt != null && alt > bestAlt) { bestAlt = alt; bestTime = t; }
  }
  if (!bestTime) return false;
  return Math.abs((bestTime.getTime() - viewTime.getTime()) / 60000) <= 60;
}

interface QueryReader {
  get(name: string): string | null;
}

function parseSatellitePass(params: QueryReader): SatelliteGuidePass | null {
  if (params.get("satellite") !== "iss") return null;

  function point(prefix: string) {
    const time = params.get(`${prefix}Time`);
    const azimuth = Number(params.get(`${prefix}Azimuth`));
    const elevation = Number(params.get(`${prefix}Elevation`));
    const direction = params.get(`${prefix}Direction`);
    if (!time || !Number.isFinite(azimuth) || !Number.isFinite(elevation) || !direction) return null;
    return { time, azimuth, elevation, direction };
  }

  const start = point("start");
  const peak = point("peak");
  const end = point("end");
  if (!start || !peak || !end) return null;
  return {
    start,
    peak,
    end,
    durationMinutes: Math.max(1, Math.round((new Date(end.time).getTime() - new Date(start.time).getTime()) / 60_000)),
  };
}

export default function SkyMapPageWrapper() {
  return (
    <Suspense
      fallback={
        <div
          className="flex flex-col"
          style={{ height: "calc(100dvh - 3rem)" }}
        />
      }
    >
      <SkyMapPage />
    </Suspense>
  );
}

function SkyMapPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [astronomyCatalog, setAstronomyCatalog] = useState<AstronomyCatalog>(() => getLocalAstronomyCatalog());
  useEffect(() => {
    let cancelled = false;
    fetch("/api/astronomy/catalog")
      .then((response) => response.json())
      .then((payload: { code?: number; data?: AstronomyCatalog }) => {
        if (!cancelled && payload.code === 0 && payload.data?.brightStars && payload.data.constellations) {
          setAstronomyCatalog(payload.data);
        }
      })
      .catch(() => {
        // 本地目录作为短暂离线降级，避免数据库暂时不可用时星图空白。
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const targetParam = searchParams.get("target");
  const rawSource = searchParams.get("source");
  const rawTimeContext = searchParams.get("timeContext");
  const eventTimeParam = searchParams.get("eventTime");
  const rawMode = searchParams.get("mode");
  const satellitePass = parseSatellitePass(searchParams);
  const satelliteGuideKey = satellitePass?.start.time ?? null;
  const [showSatellitePassGuide, setShowSatellitePassGuide] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!satelliteGuideKey) {
        setShowSatellitePassGuide(false);
        return;
      }
      const storageKey = `eop.satellite-guide-shown:${satelliteGuideKey}`;
      if (window.sessionStorage.getItem(storageKey)) {
        setShowSatellitePassGuide(false);
        return;
      }
      window.sessionStorage.setItem(storageKey, "1");
      setShowSatellitePassGuide(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [satelliteGuideKey]);
  const returnAz = readPoseParam(searchParams.get("returnAz"), 0, 360);
  const returnPitch = readPoseParam(searchParams.get("returnPitch"), -90, 90);
  const returnGamma = readPoseParam(searchParams.get("returnGamma"), -180, 180);
  const hasReturnPose = returnAz != null && returnPitch != null;

  // source 归一化：缺失/非法 → "primary"
  const source: "primary" | "secondary" | "related" | "search" =
    rawSource === "secondary" ? "secondary" :
    rawSource === "related" ? "related" :
    rawSource === "search" ? "search" :
    "primary";

  // source-aware 引导文案
  const targetConstellation = astronomyCatalog.constellations.find((item) => item.slug === targetParam);
  const targetCosmicObject = astronomyCatalog.cosmicObjects.find((object) => object.slug === targetParam);
  const baseGuide = targetConstellation
    ? { target: targetConstellation.nameZh, reason: `进入${targetConstellation.nameZh}视图后，系统会展示成员恒星和认星连线。` }
    : targetCosmicObject
    ? { target: targetCosmicObject.nameZh, reason: `在平面总览中定位${targetCosmicObject.nameZh}的赤经与赤纬位置。` }
    : targetParam
    ? (targetGuide[targetParam] ?? {
        target: targetParam,
        reason: "从首页推荐进入，查看当前可观测位置。",
      })
    : defaultGuide;

  const guide =
    targetParam && source === "secondary"
      ? {
          target: baseGuide.target,
          reason: `也可以看看${baseGuide.target}，${baseGuide.reason.replace(/^首页推荐，/, "").replace(/^通用推荐，/, "")}`,
        }
    : targetParam && source === "related"
      ? {
          target: baseGuide.target,
          reason: `从当前对象继续探索，试试${baseGuide.target}`,
        }
      : baseGuide;

  const [selected, setSelected] = useState<ObjectContent | null>(null);
  const [achievementData, setAchievementData] = useState<AchievementCenterData | null>(null);
  const captureParam = searchParams.get("capture");
  const captureRouteLaunchRef = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/achievements", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || payload.code !== 0) throw new Error(payload.message || "achievements unavailable");
        return payload.data as AchievementCenterData;
      })
      .then(setAchievementData)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAchievementData(null);
      });
    return () => controller.abort();
  }, []);

  const displayTimeKey: TimeContextKey = rawTimeContext &&
    (["now", "plus1h", "late"] as string[]).includes(rawTimeContext)
    ? (rawTimeContext as TimeContextKey) : "now";
  const [timeOffsetMinutes, setTimeOffsetMinutes] = useState(0);
  const [timeSliderCollapsed, setTimeSliderCollapsed] = useState(false);
  const [clockNow, setClockNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const eventTime = eventTimeParam ? new Date(eventTimeParam) : null;
  const baseTime = eventTime && !Number.isNaN(eventTime.getTime())
    ? eventTime
    : resolveTimeContext(rawTimeContext);
  const obsTime = new Date(baseTime.getTime() + timeOffsetMinutes * 60000);
  const timeText = obsTime.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  const dateText = obsTime.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
  const offsetText = timeOffsetMinutes === 0
    ? "现在"
    : `${timeOffsetMinutes > 0 ? "+" : ""}${Math.round((timeOffsetMinutes / 60) * 10) / 10}h`;
  const [obsLocation, setObsLocation] = useState({ lat: 39.9, lng: 116.4 });
  // 先用默认位置绘制，避免定位权限/网络响应慢时整张星图消失。
  const [locationResolved, setLocationResolved] = useState(true);
  const [orientationStatus, setOrientationStatus] = useState<OrientationStatus>(
    hasReturnPose ? "active" : "standard",
  );
  const [orientationAz, setOrientationAz] = useState<number | null>(returnAz);
  const [orientationPitch, setOrientationPitch] = useState<number | null>(returnPitch);
  const [orientationGamma, setOrientationGamma] = useState<number | null>(returnGamma);
  const [arActive, setArActive] = useState(false);
  const [arAimTarget, setArAimTarget] = useState<ObjectContent | null>(null);
  const [arNearbyTargets, setArNearbyTargets] = useState<ObjectContent[]>([]);
  const [arLockedTarget, setArLockedTarget] = useState<ObjectContent | null>(null);
  const [photoArGuide, setPhotoArGuide] = useState<PhotoArGuide | null>(null);
  const [calibration, setCalibration] = useState<ObservationCalibration | null>(null);
  const [arLaunchRequest, setArLaunchRequest] = useState(0);
  const [captureLaunchRequest, setCaptureLaunchRequest] = useState(0);
  const arRouteLaunchRef = useRef(false);
  const observationReady =
    orientationStatus === "active" && orientationAz != null && orientationPitch != null;
  const rawOrientation: ObservationPose | null = orientationAz != null && orientationPitch != null
    ? { azimuth: orientationAz, pitch: orientationPitch, gamma: orientationGamma ?? 0 }
    : null;
  const correctedOrientation = rawOrientation
    ? applyObservationCalibration(rawOrientation, calibration)
    : null;
  const requestedMode: "2d" | "observe" | "ar" =
    rawMode === "2d" ? "2d" : rawMode === "ar" ? "ar" : "observe";
  const skyMapMode: "2d" | "observe" | "ar" = arActive ? "ar" : requestedMode;
  const captureLaunchKey = captureParam === "1" && skyMapMode !== "2d"
    ? `${skyMapMode}:${targetParam ?? ""}`
    : null;

  useEffect(() => {
    if (!captureLaunchKey) {
      captureRouteLaunchRef.current = null;
      return;
    }
    if (captureRouteLaunchRef.current === captureLaunchKey) return;
    captureRouteLaunchRef.current = captureLaunchKey;
    setCaptureLaunchRequest((request) => request + 1);
  }, [captureLaunchKey]);

  const activeAchievementTask = useMemo(
    () => getActiveAchievementTask(achievementData, selected?.slug ?? null),
    [achievementData, selected?.slug],
  );

  /** 请求设备方向权限 */
  const activateOrientation = useCallback(async (): Promise<boolean> => {
    setOrientationStatus("activating");

    // 桌面端 / 不支持 DeviceOrientation
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      setOrientationStatus("unavailable");
      setTimeout(() => setOrientationStatus("standard"), 2000);
      return false;
    }

    try {
      // iOS Safari 需要显式调用 requestPermission
      const DOP = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<"granted" | "denied">;
      };

      if (typeof DOP.requestPermission === "function") {
        const result = await DOP.requestPermission();
        if (result === "granted") {
          setOrientationStatus("active");
          return true;
        } else {
          setOrientationStatus("standard");
          return false;
        }
      } else {
        // 其他浏览器：直接尝试激活（不阻塞）
        setOrientationStatus("active");
        return true;
      }
    } catch {
      setOrientationStatus("standard");
      return false;
    }
  }, []);

  const deactivateOrientation = useCallback(() => {
    setOrientationAz(null);
    setOrientationPitch(null);
    setOrientationGamma(null);
    setOrientationStatus("standard");
    setArActive(false);
    setArAimTarget(null);
    setArNearbyTargets([]);
    setArLockedTarget(null);
    setPhotoArGuide(null);
  }, []);

  useEffect(() => {
    if (!(skyMapMode === "observe" || skyMapMode === "ar") || orientationStatus !== "standard") return;
    const deviceOrientation = typeof window !== "undefined"
      ? (window as Window & { DeviceOrientationEvent?: { requestPermission?: unknown } }).DeviceOrientationEvent
      : null;
    // Android and desktop-compatible browsers can enter observation mode directly.
    // iOS keeps the explicit button because its sensor permission requires a gesture.
    if (!deviceOrientation || typeof deviceOrientation.requestPermission !== "function") {
      const timer = window.setTimeout(() => void activateOrientation(), 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [activateOrientation, orientationStatus, skyMapMode]);

  const switchSkyMapMode = useCallback((mode: "2d" | "observe") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", mode);
    if (mode === "2d") {
      deactivateOrientation();
      setPhotoArGuide(null);
    } else {
      setArActive(false);
      void activateOrientation();
    }
    router.replace(`/sky-map?${params.toString()}`);
  }, [activateOrientation, deactivateOrientation, router, searchParams]);

  const handleArActiveChange = useCallback((active: boolean) => {
    setArActive(active);
    setArAimTarget(null);
    setArNearbyTargets([]);
    setArLockedTarget(null);
    if (!active) setPhotoArGuide(null);
  }, []);

  const handlePhotoGuideReady = useCallback((guide: PhotoArGuide) => {
    setPhotoArGuide(guide);
  }, []);

  const clearPhotoGuide = useCallback(() => {
    setPhotoArGuide(null);
  }, []);

  const handleArLockTarget = useCallback((target: ObjectContent | null) => {
    setArLockedTarget(target);
    if (target) setPhotoArGuide(null);
  }, []);

  const exitArToObservation = useCallback(() => {
    setArActive(false);
    setArAimTarget(null);
    setArNearbyTargets([]);
    setArLockedTarget(null);
    setPhotoArGuide(null);
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "observe");
    router.replace(`/sky-map?${params.toString()}`);
  }, [router, searchParams]);

  const requestCapture = useCallback(() => {
    if (arActive) {
      exitArToObservation();
      window.setTimeout(() => setCaptureLaunchRequest((request) => request + 1), 160);
      return;
    }
    setCaptureLaunchRequest((request) => request + 1);
  }, [arActive, exitArToObservation]);

  const handleCalibrationChange = useCallback((nextCalibration: ObservationCalibration | null) => {
    setCalibration(nextCalibration);
    setPhotoArGuide(null);
    if (typeof window === "undefined") return;
    if (nextCalibration) {
      window.localStorage.setItem(OBSERVATION_CALIBRATION_STORAGE_KEY, JSON.stringify(nextCalibration));
    } else {
      window.localStorage.removeItem(OBSERVATION_CALIBRATION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(OBSERVATION_CALIBRATION_STORAGE_KEY);
        if (!stored) {
          setCalibration(null);
          return;
        }
        const parsed = JSON.parse(stored) as ObservationCalibration;
        setCalibration(isObservationCalibrationValid(parsed, clockNow, obsLocation) ? parsed : null);
      } catch {
        setCalibration(null);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [clockNow, obsLocation]);

  useEffect(() => {
    if (rawMode !== "ar") {
      arRouteLaunchRef.current = false;
      return;
    }
    if (arRouteLaunchRef.current || arActive) return;
    arRouteLaunchRef.current = true;
    setArLaunchRequest((request) => request + 1);
  }, [arActive, rawMode]);

  const handleArAimTargetChange = useCallback((target: ObjectContent | null, nearby: ObjectContent[]) => {
    setArAimTarget(target);
    setArNearbyTargets(nearby);
  }, []);

  const switchArTargetToObservation = () => {
    if (!arLockedTarget) return;
    setSelected(arLockedTarget);
    exitArToObservation();
  };

  // 请求定位（静默回退到默认北京）
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setObsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationResolved(true);
      },
      () => { setLocationResolved(true); },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 },
    );
  }, []);

  // 朝向模式 active → 监听设备方向
  useEffect(() => {
    let rawPose: { azimuth: number; pitch: number; gamma: number } | null = null;
    let filteredPose: { azimuth: number; pitch: number; gamma: number } | null = null;
    let lastAz: number | null = null;
    let lastPitch: number | null = null;
    let lastGamma: number | null = null;
    let lastFrameAt = 0;
    let absoluteEventSeen = false;
    let animationFrame = 0;
    let fallbackTimer = 0;
    let previousRawPose: { azimuth: number; pitch: number; gamma: number } | null = null;
    let previousRawAt = 0;

    if (orientationStatus !== "active") {
      return;
    }

    const smoothingMs = arActive ? 320 : 220;
    const azDeadzone = arActive ? 0.65 : 0.45;
    const pitchDeadzone = arActive ? 0.5 : 0.35;
    const gammaDeadzone = arActive ? 1 : 0.7;

    function handleAbsoluteOrientation(e: DeviceOrientationEvent) {
      const pose = computeDeviceSkyPose(e);
      if (!pose) return;
      if (!acceptPose(pose)) return;
      absoluteEventSeen = true;
      rawPose = pose;
    }

    function handleRelativeOrientation(e: DeviceOrientationEvent) {
      // 绝对方向可用后，忽略普通事件，避免两个数据源交替写入造成抖动。
      if (absoluteEventSeen) return;
      const pose = computeDeviceSkyPose(e);
      if (!pose) return;
      if (!acceptPose(pose)) return;
      rawPose = pose;
    }

    function acceptPose(pose: { azimuth: number; pitch: number; gamma: number }) {
      const now = performance.now();
      if (previousRawPose && now - previousRawAt < 140) {
        const azJump = angleDelta(pose.azimuth, previousRawPose.azimuth);
        const pitchJump = Math.abs(pose.pitch - previousRawPose.pitch);
        if (azJump > 32 || pitchJump > 24) return false;
      }
      previousRawPose = pose;
      previousRawAt = now;
      return true;
    }

    function resetPoseFilter() {
      rawPose = null;
      filteredPose = null;
      previousRawPose = null;
      previousRawAt = 0;
      lastAz = null;
      lastPitch = null;
      lastGamma = null;
      lastFrameAt = 0;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") resetPoseFilter();
    };

    const publishFilteredPose = (timestamp: number) => {
      if (rawPose) {
        if (!filteredPose) {
          filteredPose = { ...rawPose };
        } else {
          const deltaMs = lastFrameAt > 0
            ? Math.min(100, Math.max(8, timestamp - lastFrameAt))
            : 16;
          const filterAlpha = 1 - Math.exp(-deltaMs / smoothingMs);
          filteredPose = {
            azimuth: normalizeDeg(filteredPose.azimuth + signedAngleDelta(rawPose.azimuth, filteredPose.azimuth) * filterAlpha),
            pitch: filteredPose.pitch + (rawPose.pitch - filteredPose.pitch) * filterAlpha,
            gamma: filteredPose.gamma + (rawPose.gamma - filteredPose.gamma) * filterAlpha,
          };
        }

        if (lastAz == null || angleDelta(filteredPose.azimuth, lastAz) >= azDeadzone) {
          lastAz = filteredPose.azimuth;
          setOrientationAz(filteredPose.azimuth);
        }
        if (lastPitch == null || Math.abs(filteredPose.pitch - lastPitch) >= pitchDeadzone) {
          lastPitch = filteredPose.pitch;
          setOrientationPitch(filteredPose.pitch);
        }
        if (lastGamma == null || Math.abs(filteredPose.gamma - lastGamma) >= gammaDeadzone) {
          lastGamma = filteredPose.gamma;
          setOrientationGamma(filteredPose.gamma);
        }
      }
      lastFrameAt = timestamp;
      animationFrame = requestAnimationFrame(publishFilteredPose);
    };

    window.addEventListener("deviceorientationabsolute", handleAbsoluteOrientation);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    // 某些设备不发送绝对方向事件，稍等片刻后再启用普通事件回退。
    fallbackTimer = window.setTimeout(() => {
      if (!absoluteEventSeen) {
        window.addEventListener("deviceorientation", handleRelativeOrientation);
      }
    }, 700);
    animationFrame = requestAnimationFrame(publishFilteredPose);
    return () => {
      window.clearTimeout(fallbackTimer);
      cancelAnimationFrame(animationFrame);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("deviceorientation", handleRelativeOrientation);
      window.removeEventListener("deviceorientationabsolute", handleAbsoluteOrientation);
    };
  }, [orientationStatus, arActive]);

  const handleObjectClick = useCallback(async (obj: ObjectContent) => {
    // 扩展亮星预览对象：不调 resolve，直接进入聚焦态
    if (obj.isPreviewOnly) {
      setSelected(obj);
      return;
    }
    // 先经 resolve 获取服务端权威对象
    try {
      const params = new URLSearchParams({ name: obj.name });
      if (obj.type) params.set("type", obj.type);
      const res = await fetch(`/api/sky-map/resolve?${params.toString()}`);
      const json = await res.json();
      if (json.code === 0 && json.data?.matched) {
        const o = json.data.object;
        setSelected({ name: o.nameZh, type: o.objectType, slug: o.slug });
        return;
      }
    } catch {
      /* resolve 不可用则回退到客户端数据 */
    }

    setSelected(obj);
  }, [setSelected]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 3rem)" }}>
      {/* 顶部页头 */}
      <div className="pointer-events-auto absolute top-12 left-0 right-0 z-[60] flex items-center justify-between px-4 h-8">
        <span className="text-white/35 text-xs pointer-events-none tabular-nums">
          {correctedOrientation && `仰角 ${Math.round(correctedOrientation.pitch)}°`}
        </span>
        {/* 模式区：当前模式 + 切换入口 */}
        <div className="inline-flex h-7 items-center rounded-md border border-white/10 bg-[#0d1519]/80 p-0.5 backdrop-blur-md">
          <button
            type="button"
            onClick={() => switchSkyMapMode("observe")}
            className={`h-6 px-2 text-[10px] transition-colors ${
              skyMapMode !== "2d"
                ? "rounded bg-white/10 text-white/80"
                : "text-white/35 hover:text-white/60"
            }`}
          >
            观察
          </button>
          <button
            type="button"
            onClick={() => switchSkyMapMode("2d")}
            className={`h-6 px-2 text-[10px] transition-colors ${
              skyMapMode === "2d"
                ? "rounded bg-white/10 text-white/80"
                : "text-white/35 hover:text-white/60"
            }`}
          >
            平面总览
          </button>
        </div>
        {/* 搜索入口 */}
        <SearchBar timeContext={displayTimeKey} mode={skyMapMode} catalog={astronomyCatalog} />
      </div>

      {/* 主星图区：自控可见层在上，WWT 引擎隐身在下 */}
      <div className="flex-1 relative">
        <AchievementTaskStrip data={achievementData} selectedSlug={selected?.slug ?? null} />
        {locationResolved && (
          <>
            {skyMapMode !== "2d" && (
              <WWTViewer
                onObjectClick={handleObjectClick}
                time={obsTime}
                location={obsLocation}
                target={targetParam}
                catalog={astronomyCatalog}
              />
            )}
            <StarCanvas
              onObjectClick={handleObjectClick}
              onAimTargetChange={handleArAimTargetChange}
              target={arActive && arLockedTarget ? arLockedTarget.slug : targetParam}
              source={source}
              selected={selected}
              obsTime={obsTime}
              obsLocation={obsLocation}
              is2DMode={skyMapMode === "2d"}
              orientation={correctedOrientation ?? undefined}
              arMode={arActive}
              catalog={astronomyCatalog}
              orionBestWindow={
                targetParam && (targetParam === "orion" || targetParam === "betelgeuse")
                  ? isNearBestTime(
                      targetParam === "orion" ? "betelgeuse" : targetParam,
                      "bright_star",
                      baseTime, obsTime, obsLocation,
                    )
                  : false
              }
            />
          </>
        )}
        {!locationResolved && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#070b0c] text-xs text-white/45">
            正在确认观测位置...
          </div>
        )}
        {skyMapMode !== "2d" && satellitePass && showSatellitePassGuide && (
          <SatellitePassGuide
            pass={satellitePass}
            mode={rawMode === "ar" ? "ar" : "observe"}
            orientation={correctedOrientation ? { azimuth: correctedOrientation.azimuth, pitch: correctedOrientation.pitch } : null}
            onEnableOrientation={() => void activateOrientation()}
          />
        )}
        {skyMapMode !== "2d" && (
          <ArSkyCalibration
            active={arActive}
            orientation={correctedOrientation}
            aimTarget={arAimTarget}
            nearbyTargets={arNearbyTargets}
            lockedTarget={arLockedTarget}
            onActivateOrientation={activateOrientation}
            onDeactivateOrientation={deactivateOrientation}
            onActiveChange={handleArActiveChange}
            onLockTarget={handleArLockTarget}
            onRequestCapture={requestCapture}
            photoGuide={photoArGuide}
            onClearPhotoGuide={clearPhotoGuide}
            onSwitchToObservation={switchArTargetToObservation}
            launchRequest={arLaunchRequest}
            launcherVisible={false}
            focusedConstellationName={
              astronomyCatalog.constellations.find((item) => item.slug === targetParam)?.nameZh
                ?? astronomyCatalog.constellations.find((item) => item.slug === selected?.slug)?.nameZh
                ?? astronomyCatalog.constellations.find((item) => item.memberSlugs.includes(selected?.slug ?? ""))?.nameZh
                ?? null
            }
          />
        )}
        {skyMapMode !== "2d" && !arActive && (
          <NightCaptureConfirmation
            orientation={correctedOrientation ? { azimuth: correctedOrientation.azimuth, pitch: correctedOrientation.pitch } : null}
            location={obsLocation}
            obsTime={clockNow}
            target={arLockedTarget ?? arAimTarget ?? selected}
            calibration={calibration}
            launchRequest={captureLaunchRequest}
            launcherVisible={false}
            onPhotoGuideReady={handlePhotoGuideReady}
            onPhotoGuideClear={clearPhotoGuide}
            onRequestAr={() => setArLaunchRequest((request) => request + 1)}
          />
        )}
        {skyMapMode !== "2d" && (
          <ObservationAssistant
            rawOrientation={rawOrientation}
            location={obsLocation}
            obsTime={clockNow}
            calibration={calibration}
            arActive={arActive}
            raised={observationReady && !arActive}
            satelliteGuideVisible={Boolean(satellitePass && showSatellitePassGuide)}
            onActivateOrientation={activateOrientation}
            onCalibrationChange={handleCalibrationChange}
            onRequestAr={() => setArLaunchRequest((request) => request + 1)}
            onExitAr={exitArToObservation}
            onRequestCapture={requestCapture}
          />
        )}

        {/* 观察模式时间滑杆 — 可从白天滑到黑夜 */}
        {observationReady && !arActive && timeSliderCollapsed && (
          <div className="pointer-events-none absolute bottom-4 right-4 z-30">
            <button
              onClick={() => setTimeSliderCollapsed(false)}
              className="pointer-events-auto rounded-full border border-white/10 bg-[#101820]/75 px-3 py-2 text-xs text-white/55 shadow-xl shadow-black/30 backdrop-blur-md transition-colors hover:bg-[#16222d]/80 hover:text-white/80"
            >
              时间 · {offsetText}
            </button>
          </div>
        )}
        {observationReady && !arActive && !timeSliderCollapsed && (
          <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-30 flex justify-center">
            <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-white/10 bg-[#101820]/75 px-4 py-3 shadow-2xl shadow-black/35 backdrop-blur-md">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[11px] text-white/35">时间</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold tabular-nums text-white/90">{timeText}</span>
                  <span className="text-xs tabular-nums text-white/40">{dateText}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setTimeOffsetMinutes(0)}
                    className="rounded-lg bg-white/[0.08] px-2 py-1 text-xs text-white/45 transition-colors hover:bg-white/[0.12] hover:text-white/70"
                  >
                    现在
                  </button>
                  <button
                    onClick={() => setTimeSliderCollapsed(true)}
                    className="rounded-lg bg-white/[0.05] px-2 py-1 text-xs text-white/35 transition-colors hover:bg-white/[0.10] hover:text-white/60"
                  >
                    收起
                  </button>
                </div>
              </div>
              <input
                aria-label="调整观察时间"
                type="range"
                min={TIME_OFFSET_MIN}
                max={TIME_OFFSET_MAX}
                step={TIME_STEP_MINUTES}
                value={timeOffsetMinutes}
                onChange={(e) => setTimeOffsetMinutes(clampOffset(Number(e.target.value)))}
                className="h-2 w-full cursor-pointer accent-white/80"
              />
              <div className="mt-1 flex items-center justify-between text-[10px] text-white/25">
                <span>-12h</span>
                <span className="tabular-nums text-white/40">{offsetText}</span>
                <span>+12h</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 底部承接区 — 引导态使用动态 target */}
      <BottomDrawer
        guide={skyMapMode === "2d" && !targetParam
          ? {
              target: "宇宙天体总览",
              reason: "按赤经浏览恒星、行星、星系、星云与星团。",
            }
          : guide}
        selected={selected}
        source={source}
        mode={skyMapMode}
        achievementTask={activeAchievementTask}
        viewPose={
          correctedOrientation
            ? correctedOrientation
            : null
        }
        isObservationMode={observationReady || arActive || rawMode === "observe" || rawMode === "ar"}
        isArMode={arActive}
        obsStatus={
          selected
            ? (() => {
                const base = getObjectStatus(selected.slug, selected.type, obsTime, obsLocation);
                if (!base || base === "已落下") return base;
                const best = getBestTime(selected.slug, selected.type, baseTime, obsTime, obsLocation);
                return best ? `${base} · ${best}` : base;
              })()
            : null
        }
        onDismiss={() => setSelected(null)}
        onSimulateClick={() =>
          setSelected((prev) =>
            prev
              ? null
              : {
                  name: "木星",
                  type: "planet",
                  slug: "jupiter",
                },
          )
        }
      />
    </div>
  );
}
