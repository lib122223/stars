"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import ObservationPanel from "@/features/tools/observation-panel";
import SettingsBar from "@/features/tools/settings-bar";

interface ToolsData {
  summary: string;
  sceneSuggestion: string;
  weatherHint: string;
}

type SceneType = "urban" | "suburban" | "open_space" | "balcony";

type PageState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; data: ToolsData };

export default function ToolsPage() {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [sceneType, setSceneType] = useState<SceneType | null>(null);

  const fetchData = useCallback(() => {
    setState({ status: "loading" });

    const params = new URLSearchParams();
    if (sceneType) params.set("sceneType", sceneType);
    const qs = params.toString();
    const url = `/api/tools/observation-summary${qs ? `?${qs}` : ""}`;

    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        if (json.code === 0 && json.data) {
          setState({ status: "ok", data: json.data as ToolsData });
        } else {
          setState({ status: "error" });
        }
      })
      .catch(() => {
        setState({ status: "error" });
      });
  }, [sceneType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-xl flex-col justify-center px-4 py-12">
      <div className="text-center">
        <p className="text-accent/40 text-xs tracking-wider uppercase">
          观测工具
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">
          今晚观测条件
        </h1>
      </div>

      {/* 轻设置区块：场景切换 */}
      <div className="mt-4">
        <SettingsBar
          sceneType={sceneType}
          onSceneTypeChange={setSceneType}
        />
      </div>

      <div className="mt-5">
        {state.status === "loading" && (
          <div className="space-y-5 rounded-xl bg-surface/60 p-6 sm:p-8">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="h-3 w-12 rounded-sm bg-white/[0.06] animate-pulse mb-2" />
                <div className="h-4 w-full rounded-sm bg-white/[0.04] animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {state.status === "error" && (
          <div className="rounded-xl bg-surface/60 p-6 sm:p-8 text-center">
            <p className="text-sm text-white/30">观测数据暂时无法加载</p>
            <button
              onClick={fetchData}
              className="mt-3 rounded-lg bg-white/[0.06] px-4 py-1.5 text-xs text-white/35"
            >
              重试
            </button>
          </div>
        )}

        {state.status === "ok" && (
          <ObservationPanel
            summary={state.data.summary}
            sceneSuggestion={state.data.sceneSuggestion}
            weatherHint={state.data.weatherHint}
          />
        )}
      </div>

      <div className="mt-8 flex justify-center">
        <Link
          href="/"
          className="inline-flex items-center rounded-lg bg-white/[0.06] px-4 py-2 text-xs text-white/35 transition-colors hover:bg-white/[0.10] hover:text-white/55"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
