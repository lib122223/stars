"use client";

import Link from "next/link";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import type { DaySiteCondition as ApiDaySiteCondition } from "@/lib/site-conditions";

interface SitePoint {
  lat: number;
  lng: number;
}

interface ConditionScore {
  score: number;
  label: string;
  bestTime: string | null;
  bestTimeIso?: string | null;
  bestReferenceTime: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  direction: string;
  azimuth?: number | null;
  altitude?: number | null;
  summary: string;
  reasons: string[];
}

interface DaySiteCondition {
  date: string;
  label: string;
  star: ConditionScore;
  sunsetGlow: ConditionScore;
  sunriseGlow: ConditionScore;
}

interface SiteConditions {
  location: SitePoint;
  generatedAt: string;
  dataSource?: string;
  lightPollution: {
    available: boolean;
    darknessScore: number;
    lightLevel: number | null;
    label: string;
    summary: string;
    source: string;
    sourceYear: number | null;
  };
  visibleSky: {
    observationTime: string;
    limitingMagnitude: number;
    objects: VisibleSkyObject[];
    recommended: VisibleSkyObject[];
  };
  days: DaySiteCondition[];
}

interface VisibleSkyObject {
  slug: string;
  name: string;
  type: "bright_star" | "planet" | "moon";
  altitude: number;
  direction: string;
  visibilityLabel: string;
}

interface SiteConditionMapProps {
  currentLocation: SitePoint;
  locationLabel: string;
  onDataChange?: (data: { days: ApiDaySiteCondition[] }) => void;
}

type LoadState =
  | { status: "idle" }
  | { status: "error"; requestKey: string }
  | { status: "ok"; requestKey: string; data: SiteConditions };

type CurrentLoadState = LoadState | { status: "loading" };

const TILE_SIZE = 256;
const MIN_MAP_ZOOM = 8;
const MAX_MAP_ZOOM = 14;
const MAX_NIGHT_LIGHT_ZOOM = 8;
const MAX_NIGHT_LIGHT_DISPLAY_ZOOM = 11;
const TILE_PROVIDER = {
  key: "carto",
  label: "CARTO Light",
  attribution: "© OpenStreetMap contributors © CARTO",
  url: (z: number, x: number, y: number) =>
    `https://basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`,
} as const;
const NIGHT_LIGHTS = {
  label: "NASA VIIRS 夜间灯光",
  url: (z: number, x: number, y: number) =>
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Night_Lights/default/2016-01-01/GoogleMapsCompatible_Level8/${z}/${y}/${x}.png`,
} as const;

interface MapTile {
  key: string;
  x: number;
  y: number;
  url: string;
  distance: number;
}

interface NightLightTile {
  key: string;
  x: number;
  y: number;
  size: number;
  url: string;
}

function clampLat(lat: number): number {
  return Math.max(-85, Math.min(85, lat));
}

function lngLatToWorld(point: SitePoint, zoom: number) {
  const lat = clampLat(point.lat);
  const sin = Math.sin((lat * Math.PI) / 180);
  const scale = TILE_SIZE * 2 ** zoom;
  return {
    x: ((point.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function worldToLngLat(x: number, y: number, zoom: number): SitePoint {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

function scoreTone(score: number): string {
  if (score >= 82) return "text-emerald-300";
  if (score >= 68) return "text-accent";
  if (score >= 50) return "text-amber-200";
  return "text-white/35";
}

function scoreBar(score: number): string {
  if (score >= 82) return "bg-emerald-300";
  if (score >= 68) return "bg-accent";
  if (score >= 50) return "bg-amber-200";
  return "bg-white/30";
}

export default function SiteConditionMap({ currentLocation, locationLabel, onDataChange }: SiteConditionMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [center, setCenter] = useState(currentLocation);
  const [selected, setSelected] = useState(currentLocation);
  const [zoom, setZoom] = useState(MIN_MAP_ZOOM);
  const [showNightLights, setShowNightLights] = useState(true);
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const requestKey = `${selected.lat.toFixed(5)}:${selected.lng.toFixed(5)}`;
  const currentState: CurrentLoadState =
    state.status !== "idle" && state.requestKey === requestKey
      ? state
      : { status: "loading" };

  useEffect(() => {
    const node = mapRef.current;
    if (!node) return;
    const update = () => {
      const rect = node.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      lat: selected.lat.toFixed(5),
      lng: selected.lng.toFixed(5),
    });

    fetch(`/api/tools/site-conditions?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (json.code === 0 && json.data) {
          const data = json.data as SiteConditions;
          setState({ status: "ok", requestKey, data });
          onDataChange?.(data as { days: ApiDaySiteCondition[] });
        } else {
          setState({ status: "error", requestKey });
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setState({ status: "error", requestKey });
      });

    return () => controller.abort();
  }, [onDataChange, requestKey, selected.lat, selected.lng]);

  const mapGeometry = useMemo(() => {
    if (size.w <= 0 || size.h <= 0) return null;
    const centerWorld = lngLatToWorld(center, zoom);
    const left = centerWorld.x - size.w / 2;
    const top = centerWorld.y - size.h / 2;
    const minX = Math.floor(left / TILE_SIZE);
    const maxX = Math.floor((left + size.w) / TILE_SIZE);
    const minY = Math.floor(top / TILE_SIZE);
    const maxY = Math.floor((top + size.h) / TILE_SIZE);
    const maxTile = 2 ** zoom;
    const tiles: MapTile[] = [];

    for (let tx = minX; tx <= maxX; tx++) {
      for (let ty = minY; ty <= maxY; ty++) {
        if (ty < 0 || ty >= maxTile) continue;
        const wrappedX = ((tx % maxTile) + maxTile) % maxTile;
        tiles.push({
          key: `${TILE_PROVIDER.key}-${wrappedX}-${ty}`,
          x: tx * TILE_SIZE - left,
          y: ty * TILE_SIZE - top,
          url: TILE_PROVIDER.url(zoom, wrappedX, ty),
          distance: Math.abs(tx * TILE_SIZE + TILE_SIZE / 2 - centerWorld.x)
            + Math.abs(ty * TILE_SIZE + TILE_SIZE / 2 - centerWorld.y),
        });
      }
    }
    tiles.sort((a, b) => a.distance - b.distance);

    const nightZoom = Math.min(zoom, MAX_NIGHT_LIGHT_ZOOM);
    const nightScale = 2 ** (zoom - nightZoom);
    const nightLeft = left / nightScale;
    const nightTop = top / nightScale;
    const nightMinX = Math.floor(nightLeft / TILE_SIZE);
    const nightMaxX = Math.floor((nightLeft + size.w / nightScale) / TILE_SIZE);
    const nightMinY = Math.floor(nightTop / TILE_SIZE);
    const nightMaxY = Math.floor((nightTop + size.h / nightScale) / TILE_SIZE);
    const nightMaxTile = 2 ** nightZoom;
    const lightTiles: NightLightTile[] = [];

    for (let tx = nightMinX; tx <= nightMaxX; tx++) {
      for (let ty = nightMinY; ty <= nightMaxY; ty++) {
        if (ty < 0 || ty >= nightMaxTile) continue;
        const wrappedX = ((tx % nightMaxTile) + nightMaxTile) % nightMaxTile;
        lightTiles.push({
          key: `night-${nightZoom}-${wrappedX}-${ty}`,
          x: tx * TILE_SIZE * nightScale - left,
          y: ty * TILE_SIZE * nightScale - top,
          size: TILE_SIZE * nightScale,
          url: NIGHT_LIGHTS.url(nightZoom, wrappedX, ty),
        });
      }
    }

    const selectedWorld = lngLatToWorld(selected, zoom);
    const currentWorld = lngLatToWorld(currentLocation, zoom);
    return {
      left,
      top,
      tiles,
      lightTiles,
      selectedPx: { x: selectedWorld.x - left, y: selectedWorld.y - top },
      currentPx: { x: currentWorld.x - left, y: currentWorld.y - top },
    };
  }, [center, currentLocation, selected, size, zoom]);

  function handleMapClick(e: MouseEvent<HTMLDivElement>) {
    if (!mapGeometry) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + mapGeometry.left;
    const y = e.clientY - rect.top + mapGeometry.top;
    const p = worldToLngLat(x, y, zoom);
    setSelected({ lat: p.lat, lng: p.lng });
    if (zoom > MIN_MAP_ZOOM) setCenter({ lat: p.lat, lng: p.lng });
  }

  const tileSetKey = mapGeometry
    ? `${zoom}|${mapGeometry.tiles.map((tile) => tile.key).join("|")}|${mapGeometry.lightTiles.map((tile) => tile.key).join("|")}`
    : "empty";
  const nightLayerVisible = showNightLights && zoom <= MAX_NIGHT_LIGHT_DISPLAY_ZOOM;

  return (
    <section className="rounded-xl bg-surface/60 p-4 sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs text-white/25">选址地图</p>
          <h2 className="mt-1 text-base font-medium text-white/85">点一个附近位置，看星星、早霞和晚霞条件</h2>
        </div>
        <p className="text-[10px] text-white/25">{locationLabel}</p>
      </div>

      <div
        ref={mapRef}
        onClick={handleMapClick}
        className="relative mt-4 h-[320px] cursor-crosshair overflow-hidden rounded-lg border border-white/10 bg-[#182028] sm:h-[380px]"
      >
        {mapGeometry && (
          <MapTileLayer
            key={tileSetKey}
            tiles={mapGeometry.tiles}
            lightTiles={mapGeometry.lightTiles}
            showNightLights={nightLayerVisible}
          />
        )}
        <div className="absolute left-2 top-2 z-20 flex w-8 flex-col overflow-hidden rounded bg-black/65 backdrop-blur">
          <button
            type="button"
            aria-label="放大地图"
            title="放大地图"
            disabled={zoom >= MAX_MAP_ZOOM}
            onClick={(event) => {
              event.stopPropagation();
              setCenter(selected);
              setZoom((value) => Math.min(MAX_MAP_ZOOM, value + 1));
            }}
            className="flex h-8 items-center justify-center text-lg leading-none text-white/75 transition-colors hover:bg-white/10 disabled:text-white/20"
          >
            +
          </button>
          <span className="flex h-5 items-center justify-center border-y border-white/10 text-[9px] tabular-nums text-white/45">
            {zoom}
          </span>
          <button
            type="button"
            aria-label="缩小地图"
            title="缩小地图"
            disabled={zoom <= MIN_MAP_ZOOM}
            onClick={(event) => {
              event.stopPropagation();
              setCenter(selected);
              setZoom((value) => Math.max(MIN_MAP_ZOOM, value - 1));
            }}
            className="flex h-8 items-center justify-center text-lg leading-none text-white/75 transition-colors hover:bg-white/10 disabled:text-white/20"
          >
            −
          </button>
        </div>
        <button
          type="button"
          aria-pressed={nightLayerVisible}
          title={zoom > MAX_NIGHT_LIGHT_DISPLAY_ZOOM ? "高倍缩放仅显示街道底图" : "切换 NASA 夜间灯光"}
          onClick={(event) => {
            event.stopPropagation();
            setShowNightLights((value) => !value);
          }}
          className="absolute right-2 top-2 z-20 rounded bg-black/65 px-2 py-1 text-[10px] text-white/70 backdrop-blur transition-colors hover:bg-black/80"
        >
          {zoom > MAX_NIGHT_LIGHT_DISPLAY_ZOOM
            ? "夜光为区域级"
            : `夜间灯光 ${showNightLights ? "开" : "关"}`}
        </button>
        {mapGeometry && (
          <>
            <Marker
              x={mapGeometry.currentPx.x}
              y={mapGeometry.currentPx.y}
              label="当前位置"
              tone="current"
            />
            <Marker
              x={mapGeometry.selectedPx.x}
              y={mapGeometry.selectedPx.y}
              label="评估点"
              tone="selected"
            />
          </>
        )}
        <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-white/70 px-2 py-1 text-[10px] text-slate-500 shadow-sm backdrop-blur">
          {nightLayerVisible ? NIGHT_LIGHTS.label : TILE_PROVIDER.label} · {zoom === MIN_MAP_ZOOM ? "市域范围" : `缩放 ${zoom} 级`}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-white/30">
        <span>
          评估点：{selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}
        </span>
        <button
          onClick={() => {
            setCenter(currentLocation);
            setSelected(currentLocation);
            setZoom(MIN_MAP_ZOOM);
          }}
          className="rounded bg-white/[0.06] px-2 py-1 text-white/40 transition-colors hover:bg-white/[0.10] hover:text-white/65"
        >
          回到当前位置
        </button>
      </div>

      <div className="mt-4">
        {currentState.status === "loading" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-lg bg-white/[0.04]" />
            ))}
          </div>
        )}
        {currentState.status === "error" && (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-white/35">
            该点条件暂时无法加载
          </div>
        )}
        {currentState.status === "ok" && (
          <>
            <DarkSkySummary data={currentState.data} />
            <p className="mt-2 text-[10px] text-white/24">
              数据源：{currentState.data.dataSource ?? "Open-Meteo 小时天气预报 + 空气质量预报"}；点击地图位置后按该经纬度重新评估。
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function MapTileLayer({
  tiles,
  lightTiles,
  showNightLights,
}: {
  tiles: MapTile[];
  lightTiles: NightLightTile[];
  showNightLights: boolean;
}) {
  const loadedKeys = useRef(new Set<string>());
  const failedKeys = useRef(new Set<string>());
  const [stats, setStats] = useState({ loaded: 0, failed: 0 });

  function markLoaded(key: string) {
    if (loadedKeys.current.has(key)) return;
    loadedKeys.current.add(key);
    failedKeys.current.delete(key);
    setStats({ loaded: loadedKeys.current.size, failed: failedKeys.current.size });
  }

  function markFailed(key: string) {
    if (failedKeys.current.has(key) || loadedKeys.current.has(key)) return;
    failedKeys.current.add(key);
    setStats({ loaded: loadedKeys.current.size, failed: failedKeys.current.size });
  }

  const settled = stats.loaded + stats.failed;
  const failedAll = tiles.length > 0 && stats.failed === tiles.length;

  return (
    <>
      {tiles.map((tile) => (
        // Raster tiles need exact absolute positioning, so Next Image is not suitable here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={tile.key}
          src={tile.url}
          alt=""
          className="absolute max-w-none select-none"
          draggable={false}
          loading="eager"
          decoding="async"
          fetchPriority={tile.distance < TILE_SIZE * 1.5 ? "high" : "auto"}
          style={{ left: tile.x, top: tile.y, width: TILE_SIZE + 1, height: TILE_SIZE + 1 }}
          onLoad={() => markLoaded(tile.key)}
          onError={(event) => {
            event.currentTarget.style.visibility = "hidden";
            markFailed(tile.key);
          }}
        />
      ))}
      {showNightLights && <div className="pointer-events-none absolute inset-0 bg-[#02070d]/45" />}
      {showNightLights && lightTiles.map((tile) => (
        // NASA GIBS tiles align to the same Web Mercator grid as the base map.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={tile.key}
          src={tile.url}
          alt=""
          className="pointer-events-none absolute max-w-none opacity-[0.68] mix-blend-screen sepia saturate-200"
          draggable={false}
          loading="eager"
          decoding="async"
          style={{ left: tile.x, top: tile.y, width: tile.size + 1, height: tile.size + 1 }}
        />
      ))}
      {stats.loaded === 0 && settled < tiles.length && (
        <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/55 px-2 py-1 text-[10px] text-white/55 backdrop-blur">
          地图加载中
        </div>
      )}
      {failedAll && (
        <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/55 px-2 py-1 text-[10px] text-white/55 backdrop-blur">
          底图暂时无法加载，可稍后重试
        </div>
      )}
    </>
  );
}

function DarkSkySummary({ data }: { data: SiteConditions }) {
  const [expanded, setExpanded] = useState(false);
  const objects = expanded ? data.visibleSky.objects : data.visibleSky.objects.slice(0, 8);
  const referenceTime = new Date(data.visibleSky.observationTime).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const recommended = new Set(data.visibleSky.recommended.map((object) => object.slug));

  return (
    <div className="mb-4 border-y border-white/8 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs text-accent/45">附近暗夜评估</p>
          <div className="mt-1 flex items-baseline gap-2">
            <h3 className="text-base font-medium text-white/80">{data.lightPollution.label}</h3>
            <span className="text-xs tabular-nums text-white/35">暗夜 {data.lightPollution.darknessScore}/100</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-white/42">{data.lightPollution.summary}</p>
          <p className="mt-1 text-[10px] text-white/22">
            {data.lightPollution.available
              ? `${data.lightPollution.source} ${data.lightPollution.sourceYear} 年度图层，约 9 km 邻域取样`
              : data.lightPollution.source}
          </p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-[10px] text-white/25">预计肉眼极限</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-accent">
            {data.visibleSky.limitingMagnitude.toFixed(1)} 等
          </p>
          <p className="text-[10px] text-white/25">参考时间 {referenceTime}</p>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-white/65">今晚实际可见星表</p>
          <p className="mt-0.5 text-[10px] text-white/25">
            共 {data.visibleSky.objects.length} 个目录目标，前四项按首页同一规则选出
          </p>
        </div>
        {data.visibleSky.objects.length > 8 && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded bg-white/[0.06] px-2 py-1 text-[10px] text-white/40 transition-colors hover:bg-white/[0.1] hover:text-white/65"
          >
            {expanded ? "收起" : "查看全部"}
          </button>
        )}
      </div>

      {objects.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {objects.map((object) => (
            <Link
              key={object.slug}
              href={`/sky-map?target=${object.slug}&source=primary`}
              className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-white/[0.035] px-3 py-2 transition-colors hover:bg-white/[0.07]"
            >
              <div className="min-w-0">
                <p className="truncate text-xs text-white/65">{object.name}</p>
                <p className="mt-0.5 text-[10px] text-white/25">
                  {object.direction} · 高度 {object.altitude.toFixed(0)}°
                </p>
              </div>
              <span className={`shrink-0 text-[9px] ${recommended.has(object.slug) ? "text-accent/65" : "text-white/28"}`}>
                {recommended.has(object.slug) ? "推荐目标" : object.visibilityLabel}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md bg-white/[0.03] px-3 py-3 text-xs text-white/30">
          当前条件下没有筛出可靠的肉眼目标，可以换一个更暗的位置或调整观测时间。
        </p>
      )}
    </div>
  );
}

function Marker({
  x,
  y,
  label,
  tone,
}: {
  x: number;
  y: number;
  label: string;
  tone: "current" | "selected";
}) {
  const color = tone === "selected" ? "bg-accent" : "bg-white";
  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: x, top: y, transform: "translate(-50%, -100%)" }}
    >
      <div className="flex flex-col items-center">
        <span className={`h-3 w-3 rounded-full ${color} shadow-lg shadow-black/50`} />
        <span className="mt-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white/70 backdrop-blur">
          {label}
        </span>
      </div>
    </div>
  );
}

// Kept as a local fallback renderer for the map data shape; the timeline owns the visible event cards.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function DayCard({ day }: { day: DaySiteCondition }) {
  return (
    <article className="rounded-lg border border-white/10 bg-[#101820]/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-white/80">{day.label}</h3>
          <p className="mt-0.5 text-[10px] text-white/25">{day.date}</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <ConditionRow title="看星星" condition={day.star} />
        <ConditionRow title="晚霞" condition={day.sunsetGlow} />
        <ConditionRow title="早霞" condition={day.sunriseGlow} />
      </div>
    </article>
  );
}

function ConditionRow({ title, condition }: { title: string; condition: ConditionScore }) {
  const windowText = condition.windowStart && condition.windowEnd
    ? `${condition.windowStart} - ${condition.windowEnd}`
    : "暂无窗口";

  return (
    <div className="rounded-md bg-white/[0.035] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-white/70">{title}</p>
          <p className="mt-0.5 text-[10px] text-white/28">窗口：{windowText}</p>
          <p className="mt-0.5 text-[10px] text-white/28">
            {condition.bestReferenceTime ? `最佳参考点：${condition.bestReferenceTime} · ${condition.direction}` : condition.direction}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-semibold tabular-nums ${scoreTone(condition.score)}`}>
            {condition.score}
          </p>
          <p className="text-[10px] text-white/28">{condition.label}</p>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded bg-white/[0.06]">
        <div className={`h-full ${scoreBar(condition.score)}`} style={{ width: `${condition.score}%` }} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-white/45">{condition.summary}</p>
      {condition.reasons.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {condition.reasons.slice(0, 3).map((reason) => (
            <span key={reason} className="rounded bg-white/[0.055] px-1.5 py-0.5 text-[10px] text-white/32">
              {reason}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
