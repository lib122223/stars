"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  bodyMaps,
  featureCategoryColors,
  featureCategoryLabels,
  type BodyFeature,
  type BodyFeatureCategory,
  type BodyMapConfig,
} from "@/lib/astronomy/body-map-data";

interface BodyMapViewerProps {
  config: BodyMapConfig;
}

interface ScreenMarker {
  feature: BodyFeature;
  x: number;
  y: number;
  visible: boolean;
  scale: number;
}

type LaunchPhase = "idle" | "confirm" | "descent";

interface DescentCameraPath {
  startTime: number;
  startPosition: THREE.Vector3;
  approachPosition: THREE.Vector3;
  finalPosition: THREE.Vector3;
  startLookAt: THREE.Vector3;
  finalLookAt: THREE.Vector3;
  startFov: number;
  rocketStart: THREE.Vector3;
  rocketControl: THREE.Vector3;
  rocketEnd: THREE.Vector3;
}

const bodyLinks = Object.values(bodyMaps).map((body) => ({
  slug: body.slug,
  nameZh: body.nameZh,
  href: `/tools/body-map/${body.slug}`,
}));

export default function BodyMapViewer({ config }: BodyMapViewerProps) {
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const activeCategoriesRef = useRef<Set<BodyFeatureCategory>>(new Set(config.categories));
  const rotationSpeedRef = useRef(0.22);
  const sceneRef = useRef<{
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    bodyGroup: THREE.Group;
    bodyRotation: THREE.Euler;
    width: number;
    height: number;
  } | null>(null);
  const launchPhaseRef = useRef<LaunchPhase>("idle");
  const selectedFeatureRef = useRef<BodyFeature | undefined>(undefined);
  const descentRef = useRef<DescentCameraPath | null>(null);
  const landscapePromptDismissedRef = useRef(false);
  const [activeCategories, setActiveCategories] = useState<Set<BodyFeatureCategory>>(
    () => new Set(config.categories),
  );
  const [rotationSpeed, setRotationSpeed] = useState(0.22);
  const [launchPhase, setLaunchPhase] = useState<LaunchPhase>("idle");
  const [showLandscapePrompt, setShowLandscapePrompt] = useState(false);
  const [showLandingPanel, setShowLandingPanel] = useState(true);
  const [showControlsPanel, setShowControlsPanel] = useState(true);
  const [showFeaturePanel, setShowFeaturePanel] = useState(true);
  const [selectedId, setSelectedId] = useState(config.features[0]?.id ?? "");
  const [markers, setMarkers] = useState<ScreenMarker[]>([]);
  const selectedFeature = useMemo(
    () => config.features.find((feature) => feature.id === selectedId) ?? config.features[0],
    [config.features, selectedId],
  );

  useEffect(() => {
    selectedFeatureRef.current = selectedFeature;
  }, [selectedFeature]);

  useEffect(() => {
    launchPhaseRef.current = launchPhase;
    if (launchPhase !== "descent") {
      descentRef.current = null;
    }
  }, [launchPhase]);

  useEffect(() => {
    rotationSpeedRef.current = rotationSpeed;
  }, [rotationSpeed]);

  async function requestLandscapeMode() {
    landscapePromptDismissedRef.current = false;
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {}

    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: "landscape") => Promise<void>;
      };
      if (orientation.lock) {
        await orientation.lock("landscape");
      }
    } catch {}

    const alreadyLandscape = window.matchMedia("(orientation: landscape)").matches;
    setShowLandscapePrompt(!alreadyLandscape);
    window.dispatchEvent(new Event("resize"));
  }

  useEffect(() => {
    const update = () => {
      const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const alreadyLandscape = window.matchMedia("(orientation: landscape)").matches;
      if (alreadyLandscape) landscapePromptDismissedRef.current = false;
      setShowLandscapePrompt(
        launchPhaseRef.current === "idle" &&
          coarsePointer &&
          !alreadyLandscape &&
          window.innerWidth < window.innerHeight &&
          window.innerWidth < 900 &&
          !landscapePromptDismissedRef.current,
      );
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  useEffect(() => {
    if (launchPhase !== "descent") return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        site: selectedFeature.nameZh,
        siteEn: selectedFeature.nameEn,
        lat: selectedFeature.lat.toFixed(1),
        lon: selectedFeature.lon.toFixed(1),
      });
      router.push(`/tools/lunar-rover?${params.toString()}`);
    }, 5200);
    return () => window.clearTimeout(timer);
  }, [launchPhase, router, selectedFeature]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#02050a");

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(...config.defaultCamera);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.7;
    controls.minDistance = 1.75;
    controls.maxDistance = 5.2;
    controls.enablePan = false;
    controls.target.set(0, 0, 0);

    const bodyRotation = new THREE.Euler(...config.initialRotation);
    const texture = config.slug === "moon" ? null : new THREE.TextureLoader().load(config.texture);
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }

    const bodyGroup = new THREE.Group();
    bodyGroup.rotation.copy(bodyRotation);
    scene.add(bodyGroup);

    const geometry = new THREE.SphereGeometry(1, 96, 64);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.95,
      metalness: 0,
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.visible = config.slug !== "moon";
    bodyGroup.add(sphere);

    if (config.slug === "moon") {
      const loader = new GLTFLoader();
      loader.load(
        "/assets/models/nasa/moon_small.glb",
        (gltf) => {
          const nasaMoon = normalizeLoadedModel(gltf.scene, 1);
          bodyGroup.add(nasaMoon);
        },
        undefined,
        () => {
          sphere.visible = true;
        },
      );
    }

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.035, 96, 64),
      new THREE.MeshBasicMaterial({
        color: config.slug === "mars" ? "#ff8c55" : config.slug === "mercury" ? "#b6c0ce" : "#85baff",
        transparent: true,
        opacity: config.slug === "moon" ? 0.08 : 0.05,
        side: THREE.BackSide,
      }),
    );
    bodyGroup.add(atmosphere);

    scene.add(new THREE.AmbientLight("#9fb7d2", 0.95));
    const sun = new THREE.DirectionalLight("#ffffff", 2.2);
    sun.position.set(3.6, 2.2, 4.5);
    scene.add(sun);
    const rim = new THREE.DirectionalLight("#7fb7ff", 0.8);
    rim.position.set(-3.5, 1.4, -2.5);
    scene.add(rim);

    const stars = createStarField();
    scene.add(stars);

    const launchRocket = new THREE.Group();
    launchRocket.visible = false;
    scene.add(launchRocket);
    if (config.slug === "moon") {
      const rocketLoader = new GLTFLoader();
      rocketLoader.load(
        "/assets/models/nasa/saturn_v.glb",
        (gltf) => {
          launchRocket.add(normalizeLoadedModel(gltf.scene, 0.42));
        },
        undefined,
        () => {
          launchRocket.visible = false;
        },
      );
    }

    sceneRef.current = {
      camera,
      renderer,
      controls,
      bodyGroup,
      bodyRotation,
      width: mount.clientWidth,
      height: mount.clientHeight,
    };

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      if (sceneRef.current) {
        sceneRef.current.width = width;
        sceneRef.current.height = height;
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let frame = 0;
    let animationId = 0;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const phase = launchPhaseRef.current;
      if (phase === "descent") {
        controls.enabled = false;
        launchRocket.visible = config.slug === "moon" && launchRocket.children.length > 0;
        const feature = selectedFeatureRef.current;
        if (feature) {
          if (!descentRef.current) {
            descentRef.current = createDescentCameraPath(camera, controls, bodyGroup, feature);
          }
          updateDescentCamera(camera, controls, descentRef.current, performance.now());
        }
        const descent = descentRef.current;
        if (launchRocket.visible && descent) {
          const progress = THREE.MathUtils.clamp((performance.now() - descent.startTime) / 5200, 0, 1);
          updateLaunchRocket(launchRocket, descent, progress);
        }
        stars.rotation.y += 0.00008;
      } else {
        controls.enabled = true;
        launchRocket.visible = false;
        controls.update();
        stars.rotation.y += 0.00025;
        bodyGroup.rotation.y += rotationSpeedRef.current * 0.00075;
      }
      bodyRotation.copy(bodyGroup.rotation);
      renderer.render(scene, camera);
      frame += 1;
      if (phase === "descent") {
        if (frame % 8 === 0) {
          setMarkers((current) => (current.length > 0 ? [] : current));
        }
      } else if (frame % 2 === 0) {
        setMarkers(projectFeatures(config.features, activeCategoriesRef.current, camera, bodyRotation, mount.clientWidth, mount.clientHeight));
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      observer.disconnect();
      controls.dispose();
      texture?.dispose();
      disposeObjectTree(bodyGroup);
      disposeObjectTree(launchRocket);
      stars.geometry.dispose();
      if (Array.isArray(stars.material)) {
        stars.material.forEach((m) => m.dispose());
      } else {
        stars.material.dispose();
      }
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, [config]);

  function toggleCategory(category: BodyFeatureCategory) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      activeCategoriesRef.current = next;
      return next;
    });
  }

  return (
    <div className="relative h-[calc(100svh-3rem)] min-h-[30rem] overflow-hidden bg-black max-sm:landscape:min-h-0">
      <style>{`
        @media (orientation: landscape) and (max-width: 900px) {
          .body-map-panel { max-height: calc(100svh - 1rem); overflow-y: auto; padding: .75rem; }
          .body-map-controls { width: min(18rem, 31vw); }
          .body-map-feature { width: min(20rem, 34vw); }
          .body-map-landing { width: min(18rem, 31vw); }
        }
      `}</style>
      <div ref={mountRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_0%,transparent_42%,rgba(0,0,0,0.55)_100%)]" />

      <header className={`pointer-events-none absolute left-0 right-0 top-0 z-20 px-3 py-3 sm:px-4 sm:py-4 ${launchPhase === "descent" ? "hidden" : ""}`}>
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-2 max-sm:flex-col">
          <div className="min-w-0">
            <Link href="/tools" className="pointer-events-auto text-xs text-white/35 hover:text-white/65">
              返回工具
            </Link>
            <h1 className="mt-1 text-lg font-semibold tracking-tight text-white/90 sm:mt-2 sm:text-2xl">
              3D {config.nameZh}地貌地图
            </h1>
            <p className="mt-1 hidden text-xs text-white/38 sm:block">
              {config.subtitle} · 半径约 {config.radiusKm.toLocaleString("zh-CN")} km
            </p>
          </div>
          <div className="pointer-events-auto flex max-w-full shrink-0 gap-2 overflow-x-auto pb-1 max-sm:w-full">
            <button
              type="button"
              onClick={requestLandscapeMode}
              className="shrink-0 rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white/75 sm:hidden"
            >
              横屏
            </button>
            {bodyLinks.map((body) => (
              <Link
                key={body.slug}
                href={body.href}
                className={`shrink-0 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  body.slug === config.slug
                    ? "border-accent/35 bg-accent/15 text-accent"
                    : "border-white/10 bg-black/30 text-white/45 hover:bg-white/[0.06] hover:text-white/70"
                }`}
              >
                {body.nameZh}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {config.slug === "moon" && (
        <div className={`body-map-landing absolute right-4 top-24 z-20 hidden w-[min(18rem,calc(100vw-2rem))] flex-col gap-2 sm:flex ${launchPhase === "descent" || !showLandingPanel ? "hidden" : ""}`}>
          <button type="button" onClick={() => setShowLandingPanel(false)} className="self-end rounded-md border border-white/10 bg-black/45 px-2 py-1 text-[10px] text-white/45 backdrop-blur-md hover:text-white/75">
            收起面板
          </button>
          <div className="rounded-lg border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-md">
            <p className="text-[10px] text-white/25">当前着陆区</p>
            <p className="mt-1 text-sm font-medium text-white/75">{selectedFeature.nameZh}</p>
            <p className="mt-1 text-[10px] text-white/28">
              {selectedFeature.lat.toFixed(1)}°, {selectedFeature.lon.toFixed(1)}° · 先点选月面标注可更换地点
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLaunchPhase("confirm")}
            className="rounded-lg border border-accent/30 bg-accent/18 px-4 py-2 text-sm font-medium text-accent shadow-xl shadow-black/30 transition-colors hover:bg-accent/25"
          >
            发射到此区域
          </button>
        </div>
      )}

      <div className={`pointer-events-none absolute inset-0 z-10 ${launchPhase === "descent" ? "hidden" : ""}`}>
        {markers.map((marker) => {
          if (!marker.visible) return null;
          const color = featureCategoryColors[marker.feature.category];
          const selected = marker.feature.id === selectedId;
          return (
            <button
              key={marker.feature.id}
              type="button"
              onClick={() => setSelectedId(marker.feature.id)}
              className="pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap text-left"
              style={{ left: marker.x, top: marker.y, opacity: marker.scale }}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full shadow-[0_0_12px_currentColor] sm:h-2.5 sm:w-2.5"
                style={{ backgroundColor: color, color, transform: selected ? "scale(1.45)" : "scale(1)" }}
              />
              <span
                className={`rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm ${
                  selected ? "text-white" : "text-white/75"
                } ${selected ? "max-sm:inline" : "max-sm:hidden"}`}
              >
                {marker.feature.nameZh}
              </span>
            </button>
          );
        })}
      </div>

      <aside className={`body-map-panel body-map-controls absolute bottom-4 left-4 z-20 hidden w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-black/45 p-4 backdrop-blur-md sm:block ${launchPhase === "descent" || !showControlsPanel ? "hidden" : ""}`}>
        <button type="button" onClick={() => setShowControlsPanel(false)} className="float-right text-[10px] text-white/35 hover:text-white/75">
          收起
        </button>
        <p className="text-xs text-white/25">地貌类型</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {config.categories.map((category) => {
            const active = activeCategories.has(category);
            return (
              <button
                key={category}
                type="button"
                onClick={() => toggleCategory(category)}
                className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
                  active
                    ? "border-white/12 bg-white/[0.08] text-white/70"
                    : "border-white/5 bg-black/20 text-white/24"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: featureCategoryColors[category] }}
                />
                {featureCategoryLabels[category]}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-white/24">
          拖动旋转，双指或滚轮缩放。标注点为地貌中心附近的近似经纬度位置。
        </p>
        <div className="mt-4 border-t border-white/10 pt-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="body-rotation-speed" className="text-xs text-white/25">
              自转速度
            </label>
            <span className="text-[10px] text-white/25">{Math.round(rotationSpeed * 100)}%</span>
          </div>
          <input
            id="body-rotation-speed"
            type="range"
            min="0"
            max="1"
            step="0.02"
            value={rotationSpeed}
            onChange={(event) => setRotationSpeed(Number(event.target.value))}
            className="mt-2 w-full accent-[#f0a54a]"
          />
          <p className="mt-1 text-[10px] text-white/18">
            上限已限制为慢速展示，避免旋转过快影响点选。
          </p>
        </div>
      </aside>

      {!showControlsPanel && launchPhase !== "descent" && (
        <button type="button" onClick={() => setShowControlsPanel(true)} className="absolute bottom-4 left-4 z-20 hidden rounded-md border border-white/10 bg-black/45 px-3 py-2 text-xs text-white/55 backdrop-blur-md sm:block">
          展开控制
        </button>
      )}

      {selectedFeature && (
        <section className={`body-map-panel body-map-feature absolute bottom-4 right-4 z-20 hidden w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-black/50 p-4 backdrop-blur-md sm:block ${launchPhase === "descent" || !showFeaturePanel ? "hidden" : ""}`}>
          <button type="button" onClick={() => setShowFeaturePanel(false)} className="float-right text-[10px] text-white/35 hover:text-white/75">
            收起
          </button>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] text-white/25">{featureCategoryLabels[selectedFeature.category]}</p>
              <h2 className="mt-1 text-lg font-semibold text-white/88">{selectedFeature.nameZh}</h2>
              <p className="text-xs text-white/35">{selectedFeature.nameEn}</p>
            </div>
            <span
              className="mt-1 h-3 w-3 shrink-0 rounded-full shadow-[0_0_16px_currentColor]"
              style={{ backgroundColor: featureCategoryColors[selectedFeature.category], color: featureCategoryColors[selectedFeature.category] }}
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-white/48">{selectedFeature.description}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-[10px] text-white/30">
            <div>
              <dt className="text-white/16">纬度</dt>
              <dd>{selectedFeature.lat.toFixed(1)}°</dd>
            </div>
            <div>
              <dt className="text-white/16">经度</dt>
              <dd>{selectedFeature.lon.toFixed(1)}°</dd>
            </div>
          </dl>
        </section>
      )}

      {!showFeaturePanel && selectedFeature && launchPhase !== "descent" && (
        <button type="button" onClick={() => setShowFeaturePanel(true)} className="absolute bottom-4 right-4 z-20 hidden rounded-md border border-white/10 bg-black/45 px-3 py-2 text-xs text-white/55 backdrop-blur-md sm:block">
          展开详情
        </button>
      )}

      {selectedFeature && (
        <section className={`body-map-panel body-map-feature absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-white/10 bg-black/60 p-3 shadow-2xl shadow-black/35 backdrop-blur-md sm:hidden max-sm:landscape:left-auto max-sm:landscape:w-[18rem] ${launchPhase === "descent" || !showFeaturePanel ? "hidden" : ""}`}>
          <button type="button" onClick={() => setShowFeaturePanel(false)} className="float-right text-[10px] text-white/35 hover:text-white/75">
            收起
          </button>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] text-white/25">{featureCategoryLabels[selectedFeature.category]}</p>
              <h2 className="mt-0.5 truncate text-base font-semibold text-white/90">{selectedFeature.nameZh}</h2>
              <p className="truncate text-[10px] text-white/35">{selectedFeature.nameEn}</p>
            </div>
            {config.slug === "moon" && (
              <button
                type="button"
                onClick={() => setLaunchPhase("confirm")}
                className="shrink-0 rounded-lg border border-accent/35 bg-accent/20 px-3 py-2 text-xs font-medium text-accent"
              >
                发射
              </button>
            )}
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {config.categories.map((category) => {
              const active = activeCategories.has(category);
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] transition-colors ${
                    active
                      ? "border-white/12 bg-white/[0.08] text-white/70"
                      : "border-white/5 bg-black/20 text-white/24"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: featureCategoryColors[category] }}
                  />
                  {featureCategoryLabels[category]}
                </button>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-x-3 border-t border-white/10 pt-2">
            <label htmlFor="body-rotation-speed-mobile" className="text-[10px] text-white/25">
              自转速度
            </label>
            <span className="text-[10px] text-white/25">{Math.round(rotationSpeed * 100)}%</span>
            <input
              id="body-rotation-speed-mobile"
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={rotationSpeed}
              onChange={(event) => setRotationSpeed(Number(event.target.value))}
              className="col-span-2 mt-1 w-full accent-[#f0a54a]"
            />
          </div>
        </section>
      )}

      {!showFeaturePanel && selectedFeature && launchPhase !== "descent" && (
        <button type="button" onClick={() => setShowFeaturePanel(true)} className="absolute bottom-3 right-3 z-20 rounded-md border border-white/10 bg-black/45 px-3 py-2 text-xs text-white/55 backdrop-blur-md sm:hidden">
          展开详情
        </button>
      )}

      {!showLandingPanel && config.slug === "moon" && launchPhase !== "descent" && (
        <button type="button" onClick={() => setShowLandingPanel(true)} className="absolute right-4 top-24 z-20 hidden rounded-md border border-white/10 bg-black/45 px-3 py-2 text-xs text-white/55 backdrop-blur-md sm:block">
          展开着陆面板
        </button>
      )}

      <div className={`absolute bottom-4 left-1/2 z-20 hidden -translate-x-1/2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] text-white/28 backdrop-blur-md sm:block ${launchPhase === "descent" ? "sm:hidden" : ""}`}>
        贴图来源：<a className="underline decoration-white/15 underline-offset-2 hover:text-white/50" href={config.sourceUrl} target="_blank" rel="noreferrer">{config.sourceLabel}</a>
      </div>

      {launchPhase !== "idle" && (
        <LunarLaunchOverlay
          phase={launchPhase}
          siteName={selectedFeature.nameZh}
          siteEn={selectedFeature.nameEn}
          lat={selectedFeature.lat}
          lon={selectedFeature.lon}
          onConfirm={() => setLaunchPhase("descent")}
          onCancel={() => setLaunchPhase("idle")}
        />
      )}

      {showLandscapePrompt && launchPhase === "idle" && (
        <section className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 px-6 backdrop-blur-md sm:hidden">
          <div className="max-w-sm rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-center shadow-2xl shadow-black/60">
            <p className="text-xs tracking-[0.25em] text-accent/60">LANDSCAPE VIEW</p>
            <h2 className="mt-3 text-xl font-semibold text-white/88">请横置手机查看</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/48">
              当前浏览器没有允许网页自动锁定横屏。可以手动把手机横过来，3D 模型会按横屏布局显示。
            </p>
            <button
              type="button"
              onClick={requestLandscapeMode}
              className="mt-5 w-full rounded-lg border border-accent/35 bg-accent/20 px-4 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/30"
            >
              再试一次
            </button>
            <button
              type="button"
              onClick={() => {
                landscapePromptDismissedRef.current = true;
                setShowLandscapePrompt(false);
              }}
              className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/45 transition-colors hover:bg-white/[0.08]"
            >
              继续竖屏
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function LunarLaunchOverlay({
  phase,
  siteName,
  siteEn,
  lat,
  lon,
  onConfirm,
  onCancel,
}: {
  phase: "confirm" | "descent";
  siteName: string;
  siteEn: string;
  lat: number;
  lon: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={`absolute inset-0 z-50 overflow-hidden ${phase === "confirm" ? "bg-black/35" : "pointer-events-none bg-black/5"}`}>
      <style>{`
        @keyframes lunar-lander-drop {
          0% { transform: translate(-34vw, -30vh) rotate(28deg) scale(0.16); opacity: 0; }
          10% { opacity: 1; }
          45% { transform: translate(6vw, -7vh) rotate(18deg) scale(0.55); opacity: 1; }
          78% { transform: translate(19vw, 14vh) rotate(8deg) scale(1.25); opacity: 1; }
          100% { transform: translate(22vw, 32vh) rotate(0deg) scale(2.35); opacity: 0; }
        }
        @keyframes lunar-plume {
          0%, 28% { opacity: 0; transform: scaleX(0.5); }
          52% { opacity: 0.9; transform: scaleX(1.1); }
          100% { opacity: 0.2; transform: scaleX(1.75); }
        }
        @keyframes lunar-impact-shake {
          0%, 100% { transform: translate3d(0, 0, 0); }
          74% { transform: translate3d(0, 0, 0); }
          79% { transform: translate3d(-6px, 3px, 0); }
          84% { transform: translate3d(5px, -2px, 0); }
          89% { transform: translate3d(-3px, -2px, 0); }
          94% { transform: translate3d(2px, 1px, 0); }
        }
        @keyframes lunar-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="absolute inset-0 overflow-hidden"
        style={phase === "descent" ? { animation: "lunar-impact-shake 5.2s ease-in-out forwards" } : undefined}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_0%,transparent_48%,rgba(0,0,0,0.46)_100%)]" />
      </div>

      {phase === "confirm" ? (
        <section className="absolute inset-x-4 bottom-8 mx-auto max-w-lg rounded-2xl border border-white/10 bg-black/62 p-5 text-center shadow-2xl shadow-black/50 backdrop-blur-md">
          <p className="text-xs tracking-[0.25em] text-accent/55">LANDING CONFIRMATION</p>
          <h2 className="mt-3 text-2xl font-semibold text-white/88">确认降落到 {siteName}</h2>
          <p className="mt-2 text-xs text-white/36">{siteEn} · {lat.toFixed(1)}°, {lon.toFixed(1)}°</p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/46">
            下一步会执行近月制动和垂直降落。降落完成后切换到月球车视角，在该区域采集月壤并建设第一个种植舱。
          </p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white/65"
            >
              重新选择
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 rounded-lg border border-accent/35 bg-accent/20 px-4 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/30"
            >
              点火降落
            </button>
          </div>
        </section>
      ) : (
        <div className="absolute inset-x-0 bottom-12 text-center" style={{ animation: "lunar-fade-in .7s ease-out forwards" }}>
          <p className="text-xs tracking-[0.28em] text-accent/55">POWERED DESCENT</p>
          <p className="mt-2 text-2xl font-semibold text-white/88">正在冲向 {siteName} 月表</p>
          <p className="mt-2 text-xs text-white/35">制动发动机工作中，准备切换到月球车视角</p>
        </div>
      )}
    </div>
  );
}

function createStarField() {
  const geometry = new THREE.BufferGeometry();
  const count = 900;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const radius = 18 + Math.random() * 12;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: "#dbeafe",
    size: 0.025,
    transparent: true,
    opacity: 0.55,
    sizeAttenuation: true,
  });
  return new THREE.Points(geometry, material);
}

function normalizeLoadedModel(model: THREE.Object3D, targetRadius: number) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z);
  const scale = maxAxis > 0 ? (targetRadius * 2) / maxAxis : 1;
  model.position.sub(center);
  const wrapper = new THREE.Group();
  wrapper.add(model);
  wrapper.scale.setScalar(scale);
  wrapper.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return wrapper;
}

function disposeObjectTree(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}

function createDescentCameraPath(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  bodyGroup: THREE.Group,
  feature: BodyFeature,
): DescentCameraPath {
  const normal = latLonToVector(feature.lat, feature.lon).applyEuler(bodyGroup.rotation).normalize();
  const surfaceTarget = normal.clone().multiplyScalar(1.012);
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(up, normal);
  if (side.lengthSq() < 0.0001) {
    side.set(1, 0, 0);
  }
  side.normalize();

  const startPosition = camera.position.clone();
  const startRadius = startPosition.length();
  const approachRadius = Math.max(3.05, startRadius * 0.95);
  const approachPosition = normal
    .clone()
    .multiplyScalar(approachRadius)
    .add(side.clone().multiplyScalar(0.2))
    .add(up.clone().multiplyScalar(0.08));
  const finalPosition = normal.clone().multiplyScalar(1.22).add(side.clone().multiplyScalar(0.035));

  const rocketStart = normal.clone().multiplyScalar(Math.max(4.8, startRadius + 1.2)).add(side.clone().multiplyScalar(0.85));
  const rocketControl = normal.clone().multiplyScalar(2.8).add(side.clone().multiplyScalar(0.42));
  const rocketEnd = normal.clone().multiplyScalar(1.32).add(side.clone().multiplyScalar(0.05));

  return {
    startTime: performance.now(),
    startPosition,
    approachPosition,
    finalPosition,
    startLookAt: controls.target.clone(),
    finalLookAt: surfaceTarget,
    startFov: camera.fov,
    rocketStart,
    rocketControl,
    rocketEnd,
  };
}

function updateLaunchRocket(rocket: THREE.Group, path: DescentCameraPath, progress: number) {
  const eased = easeInCubic(progress);
  const position = quadraticBezier(path.rocketStart, path.rocketControl, path.rocketEnd, eased);
  const nextPosition = quadraticBezier(path.rocketStart, path.rocketControl, path.rocketEnd, Math.min(eased + 0.012, 1));
  const velocity = nextPosition.sub(position).normalize();

  rocket.position.copy(position);
  rocket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), velocity);
  rocket.scale.setScalar(THREE.MathUtils.lerp(0.52, 1.2, easeOutCubic(progress)));
  rocket.visible = progress < 0.94;
}

function quadraticBezier(
  start: THREE.Vector3,
  control: THREE.Vector3,
  end: THREE.Vector3,
  t: number,
) {
  const oneMinusT = 1 - t;
  return start.clone()
    .multiplyScalar(oneMinusT * oneMinusT)
    .add(control.clone().multiplyScalar(2 * oneMinusT * t))
    .add(end.clone().multiplyScalar(t * t));
}

function updateDescentCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  path: DescentCameraPath,
  now: number,
) {
  const progress = THREE.MathUtils.clamp((now - path.startTime) / 5200, 0, 1);
  const turnEnd = 0.34;

  if (progress < turnEnd) {
    const turnProgress = easeInOutCubic(progress / turnEnd);
    const startDir = path.startPosition.clone().normalize();
    const approachDir = path.approachPosition.clone().normalize();
    const direction = slerpUnitVector(startDir, approachDir, turnProgress);
    const radius = THREE.MathUtils.lerp(path.startPosition.length(), path.approachPosition.length(), turnProgress);
    camera.position.copy(direction.multiplyScalar(radius));
  } else {
    const diveProgress = easeInCubic((progress - turnEnd) / (1 - turnEnd));
    camera.position.lerpVectors(path.approachPosition, path.finalPosition, diveProgress);
  }

  const lookProgress = easeOutCubic(THREE.MathUtils.clamp(progress / 0.55, 0, 1));
  const lookAt = new THREE.Vector3().lerpVectors(path.startLookAt, path.finalLookAt, lookProgress);
  controls.target.copy(lookAt);
  camera.lookAt(lookAt);
  camera.fov = THREE.MathUtils.lerp(path.startFov, 54, easeInCubic(progress));
  camera.updateProjectionMatrix();
}

function slerpUnitVector(from: THREE.Vector3, to: THREE.Vector3, t: number) {
  const dot = THREE.MathUtils.clamp(from.dot(to), -0.9995, 0.9995);
  const theta = Math.acos(dot) * t;
  const relative = to.clone().sub(from.clone().multiplyScalar(dot)).normalize();
  return from.clone().multiplyScalar(Math.cos(theta)).add(relative.multiplyScalar(Math.sin(theta))).normalize();
}

function easeInCubic(t: number) {
  const value = THREE.MathUtils.clamp(t, 0, 1);
  return value * value * value;
}

function easeOutCubic(t: number) {
  const value = THREE.MathUtils.clamp(t, 0, 1);
  return 1 - Math.pow(1 - value, 3);
}

function easeInOutCubic(t: number) {
  const value = THREE.MathUtils.clamp(t, 0, 1);
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function projectFeatures(
  features: BodyFeature[],
  activeCategories: Set<BodyFeatureCategory>,
  camera: THREE.PerspectiveCamera,
  bodyRotation: THREE.Euler,
  width: number,
  height: number,
): ScreenMarker[] {
  const cameraDir = camera.position.clone().normalize();
  return features
    .filter((feature) => activeCategories.has(feature.category))
    .map((feature) => {
      const normal = latLonToVector(feature.lat, feature.lon).applyEuler(bodyRotation).normalize();
      const position = normal.clone().multiplyScalar(1.055);
      const facing = normal.dot(cameraDir);
      const projected = position.clone().project(camera);
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      const inFrame = projected.z < 1 && x > -80 && x < width + 80 && y > -60 && y < height + 60;
      return {
        feature,
        x,
        y,
        visible: facing > 0.08 && inFrame,
        scale: Math.max(0.35, Math.min(1, facing * 1.2)),
      };
    });
}

function latLonToVector(lat: number, lon: number): THREE.Vector3 {
  const latRad = THREE.MathUtils.degToRad(lat);
  const lonRad = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(
    Math.cos(latRad) * Math.sin(lonRad),
    Math.sin(latRad),
    Math.cos(latRad) * Math.cos(lonRad),
  );
}
