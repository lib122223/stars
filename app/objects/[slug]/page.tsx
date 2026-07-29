"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ObjectSummary from "@/features/objects/object-summary";
import ObservationCard, { type ObservationData } from "@/features/objects/observation-card";
import ExplorationCard from "@/features/objects/exploration-card";
import RelatedSection from "@/features/objects/related-section";
import ReferenceImagesSection from "@/features/objects/reference-images-section";
import { computeObservation } from "@/features/objects/compute-observation";
import { getReferenceImages } from "@/lib/astronomy/reference-images";
import { type TimeContextKey, resolveTimeContext, withTimeContext } from "@/lib/time-context";

interface DetailData {
  object: {
    slug: string;
    nameZh: string;
    nameEn: string;
    objectType: string;
  };
  card: {
    whatIsIt: string;
    whyWatchIt: string;
    whatNext: string;
  } | null;
  related: Array<{ slug: string; nameZh: string }>;
}

type PageState =
  | { status: "loading" }
  | { status: "not_found"; slug: string }
  | { status: "error" }
  | { status: "ok"; data: DetailData };

export default function ObjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const fromAr = from === "ar";
  const fromObserve = from === "observe";
  const returnAz = searchParams.get("returnAz");
  const returnPitch = searchParams.get("returnPitch");
  const returnGamma = searchParams.get("returnGamma");
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [timeContext, setTimeContext] = useState<TimeContextKey>("now");
  const [obsData, setObsData] = useState<ObservationData | null>(null);
  const returnMode = fromAr ? "ar" : fromObserve ? "observe" : "2d";
  const returnParams = new URLSearchParams({
    mode: returnMode,
    target: slug,
    source: "detail",
  });
  if (returnAz && Number.isFinite(Number(returnAz))) returnParams.set("returnAz", returnAz);
  if (returnPitch && Number.isFinite(Number(returnPitch))) returnParams.set("returnPitch", returnPitch);
  if (returnGamma && Number.isFinite(Number(returnGamma))) returnParams.set("returnGamma", returnGamma);
  const returnPath = `/sky-map?${returnParams.toString()}`;

  // 请求定位（静默回退）
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => { /* 静默回退 */ },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 },
    );
  }, []);

  // 有坐标 + 数据后计算观测（timeContext 变化时重新计算）
  useEffect(() => {
    if (state.status === "ok" && geoCoords) {
      const obsTime = resolveTimeContext(timeContext);
      setObsData(computeObservation(slug, geoCoords.lat, geoCoords.lng, obsTime));
    }
  }, [slug, geoCoords, timeContext, state.status === "ok" ? state.data.object.slug : null]);

  const fetchData = useCallback(() => {
    setState({ status: "loading" });

    fetch(`/api/objects/${slug}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.code === 0 && json.data) {
          setState({ status: "ok", data: json.data as DetailData });
        } else if (json.code === 4041) {
          setState({ status: "not_found", slug });
        } else {
          setState({ status: "error" });
        }
      })
      .catch(() => {
        setState({ status: "error" });
      });
  }, [slug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (state.status === "loading") {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-xl flex-col justify-center px-4 py-12">
        <div className="text-center">
          <div className="mx-auto h-3 w-14 rounded-sm bg-white/[0.06] animate-pulse" />
          <div className="mx-auto mt-3 h-8 w-36 rounded-sm bg-white/[0.08] animate-pulse" />
          <div className="mx-auto mt-2 h-4 w-24 rounded-sm bg-white/[0.04] animate-pulse" />
        </div>
        <div className="mt-8 space-y-5 rounded-xl bg-surface/60 p-6 sm:p-8">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className="h-3 w-12 rounded-sm bg-white/[0.06] animate-pulse mb-2" />
              <div className="h-4 w-full rounded-sm bg-white/[0.04] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (state.status === "not_found") {
    const isCoord = slug.startsWith("coord-");

    return (
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-xl flex-col justify-center px-4 py-12">
        <div className="text-center">
          <p className="text-white/15 text-xs tracking-wider uppercase">
            {isCoord ? "识别未匹配" : "对象不存在"}
          </p>
          <p className="mt-2 text-lg font-medium text-white/40">
            {isCoord
              ? "该坐标位置未识别到已知天体"
              : `未找到 "${slug}" 对应的天体对象`}
          </p>
        </div>
        <div className="mt-8 flex justify-center">
          <Link
            href={withTimeContext(returnPath, timeContext)}
            className="inline-flex items-center rounded-lg bg-accent/15 px-5 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/25"
          >
            返回继续探索
          </Link>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-xl flex-col justify-center px-4 py-12">
        <div className="text-center">
          <p className="text-white/15 text-xs tracking-wider uppercase">
            加载失败
          </p>
          <p className="mt-2 text-sm text-white/30">
            详情数据暂时无法加载
          </p>
        </div>
        <div className="mt-6 flex justify-center">
          <button
            onClick={fetchData}
            className="rounded-lg bg-white/[0.06] px-4 py-2 text-xs text-white/35"
          >
            重试
          </button>
        </div>
        <div className="mt-4 flex justify-center">
          <Link
            href={withTimeContext(returnPath, timeContext)}
            className="text-xs text-white/20 hover:text-white/35"
          >
            返回继续探索
          </Link>
        </div>
      </div>
    );
  }

  const { object, card } = state.data;
  const referenceImages = getReferenceImages(object);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-xl flex-col px-4 py-12">
      {/* 1. 对象标题区 — 保留为页头，视觉权重低于动态观测卡 */}
      <ObjectSummary
        nameZh={object.nameZh}
        nameEn={object.nameEn}
        objectType={object.objectType}
      />

      {/* 2. 动态观测卡 — 第一主内容 */}
      <div className="mt-6">
        <ObservationCard data={obsData} timeContext={timeContext} onTimeContextChange={setTimeContext} />
      </div>

      <div className="mt-6">
        <ReferenceImagesSection images={referenceImages} />
      </div>

      {/* 3. 解释卡 — 降级到观测卡之后 */}
      <div className="mt-6">
        {card ? (
          <ExplorationCard
            whatIsIt={card.whatIsIt}
            whyWatchIt={card.whyWatchIt}
            whatNext={card.whatNext}
          />
        ) : (
          <div className="rounded-xl bg-surface/60 p-6 sm:p-8 text-center">
            <p className="text-sm text-white/25">解释卡片数据暂未录入</p>
            <p className="mt-1 text-xs text-white/15">
              该对象的详细信息将在后续版本中补充
            </p>
          </div>
        )}
      </div>

      {/* 4. related 承接区 — 静态 UI 占位 */}
      <div className="mt-6">
        <RelatedSection objects={state.data.related} timeContext={timeContext} />
      </div>

      {/* 5. 返回继续探索 — 主延续动作兜底 */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={() => {
            if (fromAr || fromObserve) {
              router.push(withTimeContext(returnPath, timeContext));
            } else if (window.history.length > 1) {
              router.back();
            } else {
              router.push(withTimeContext(returnPath, timeContext));
            }
          }}
          className="inline-flex items-center rounded-lg bg-accent/15 px-5 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/25"
        >
          返回继续探索
        </button>
      </div>
    </div>
  );
}
