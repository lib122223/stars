"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import PrimaryCard from "@/features/home/primary-card";
import ConditionSummary from "@/features/home/condition-summary";
import SecondaryEntry from "@/features/home/secondary-entry";
import LoadingCard from "@/features/home/loading-card";
import ErrorCard from "@/features/home/error-card";

interface HomeData {
  primaryRecommendation: {
    id: number;
    title: string;
    reason: string;
    recommendationType: string;
    targetRef: string;
    primaryAction: { label: string; type: string };
    secondaryAction: {
      label: string;
      type: string;
      targetRef: string | null;
    };
  };
  conditionSummary: { basis: string; actionHint: string };
  secondaryRecommendation: {
    id: number;
    text: string;
    recommendationType: string;
    targetRef: string;
  };
}

type SceneType = "urban" | "suburban" | "open_space" | "balcony";

const sceneLabels: { value: SceneType; label: string }[] = [
  { value: "urban", label: "城市" },
  { value: "suburban", label: "郊区" },
  { value: "open_space", label: "开阔地" },
  { value: "balcony", label: "阳台" },
];

type GeoState = "pending" | "granted" | "denied" | "unavailable";

type PageState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; data: HomeData };

export default function HomePage() {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [sceneType, setSceneType] = useState<SceneType | null>(null);
  const [geoState, setGeoState] = useState<GeoState>("pending");
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);

  // 请求浏览器定位 — 失败/拒绝均静默回退
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoState("unavailable");
      return;
    }

    const timeout = setTimeout(() => setGeoState("denied"), 8000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timeout);
        coordsRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setGeoState("granted");
      },
      () => {
        clearTimeout(timeout);
        setGeoState("denied");
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 },
    );

    return () => clearTimeout(timeout);
  }, []);

  const fetchData = useCallback(() => {
    setState({ status: "loading" });

    const params = new URLSearchParams();
    if (sceneType) params.set("sceneType", sceneType);

    // 定位已授权 → 带上真实 lat/lng
    const coords = coordsRef.current;
    if (coords) {
      params.set("lat", coords.lat.toFixed(4));
      params.set("lng", coords.lng.toFixed(4));
    }

    const qs = params.toString();
    const url = `/api/recommendations${qs ? `?${qs}` : ""}`;

    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        if (json.code === 0 && json.data) {
          setState({ status: "ok", data: json.data as HomeData });
        } else {
          setState({ status: "error" });
        }
      })
      .catch(() => {
        setState({ status: "error" });
      });
  }, [sceneType]);

  // 定位授权后重新请求
  useEffect(() => {
    if (geoState === "granted") {
      fetchData();
    }
  }, [geoState, fetchData]);

  // 首次加载 + sceneType 变化
  useEffect(() => {
    if (geoState !== "pending") {
      fetchData();
    }
  }, [fetchData, geoState]);

  if (state.status === "loading") {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-2xl flex-col justify-center px-4 py-12">
        <LoadingCard />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-2xl flex-col justify-center px-4 py-12">
        <ErrorCard onRetry={fetchData} />
      </div>
    );
  }

  const { primaryRecommendation, conditionSummary, secondaryRecommendation } =
    state.data;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-2xl flex-col justify-center px-4 py-12">
      <PrimaryCard primaryRecommendation={primaryRecommendation} />

      {/* 条件层（含定位状态轻提示） */}
      <div className="mt-3 flex flex-col items-center gap-1">
        <ConditionSummary conditionSummary={conditionSummary} />
        {geoState === "granted" && coordsRef.current && (
          <p className="text-[10px] text-white/10">
            · 已获取位置 ·
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-1">
        <span className="text-[10px] text-white/10 mr-1">场景</span>
        {sceneLabels.map(({ value, label }) => (
          <button
            key={value}
            onClick={() =>
              setSceneType((prev) => (prev === value ? null : value))
            }
            className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
              sceneType === value
                ? "bg-accent/15 text-accent/70"
                : "text-white/15 hover:text-white/30"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex justify-center">
        <SecondaryEntry
          secondaryRecommendation={secondaryRecommendation}
        />
      </div>
    </div>
  );
}
