"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type MissionStage = "collect" | "return" | "deposit" | "plant" | "complete";
type FarmPlotStage = "empty" | "seed" | "sprout" | "watered" | "mature";
type FarmAction = "plant" | "water" | "fertilize" | "harvest";

interface SoilNode {
  id: string;
  name: string;
  position: THREE.Vector3;
}

interface GameSnapshot {
  soil: number;
  storedSoil: number;
  stage: MissionStage;
  nearSoilId: string | null;
  nearBase: boolean;
  nearDoor: boolean;
  insideBase: boolean;
  greenhouseBuilt: boolean;
  planted: boolean;
  speed: number;
}

interface FarmPlot {
  id: number;
  stage: FarmPlotStage;
  readyAt: number | null;
  fertilized: boolean;
}

const ROVER_GROUND_OFFSET = 0;
const FARM_SEED_MS = 12000;
const FARM_WATERED_MS = 18000;
const FARM_FERTILIZED_MS = 6000;
const SOIL_COLLECTION_DISTANCE = 1.85;
const SOIL_TAP_RADIUS_PX = 56;

const soilNodes: SoilNode[] = [
  { id: "mare-dust-1", name: "玄武岩月壤", position: new THREE.Vector3(-5.5, 0, -6.2) },
  { id: "ridge-dust-2", name: "山脊阴影样本", position: new THREE.Vector3(4.6, 0, -7.8) },
  { id: "crater-dust-3", name: "撞击坑边缘样本", position: new THREE.Vector3(7.4, 0, 3.2) },
];

const lunarCraters = [
  { x: -7.5, z: -3.4, radius: 2.3, depth: 0.42 },
  { x: 6.2, z: 4.8, radius: 2.0, depth: 0.34 },
  { x: 1.8, z: -8.4, radius: 1.7, depth: 0.28 },
  { x: -10.5, z: 7.2, radius: 1.35, depth: 0.22 },
  { x: 10.8, z: -6.4, radius: 1.45, depth: 0.24 },
  { x: -1.8, z: 9.4, radius: 1.25, depth: 0.2 },
];

export default function LunarRoverGame() {
  const searchParams = useSearchParams();
  const landingSite = {
    name: searchParams.get("site") ?? "静海任务区",
    nameEn: searchParams.get("siteEn") ?? "Mare Tranquillitatis sector",
    lat: searchParams.get("lat") ?? "8.5",
    lon: searchParams.get("lon") ?? "31.4",
  };
  const mountRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef({ forward: 0, turn: 0 });
  const cameraViewRef = useRef({
    yawOffset: 0,
    height: 2.35,
    lookHeight: 0.55,
    distance: 4.35,
    dragging: false,
    pointerId: -1,
    lastX: 0,
    lastY: 0,
    startX: 0,
    startY: 0,
    moved: false,
  });
  const collectedRef = useRef(new Set<string>());
  const storedSoilRef = useRef(0);
  const insideBaseRef = useRef(false);
  const plantedRef = useRef(false);
  const roverRef = useRef<THREE.Group | null>(null);
  const greenhouseRef = useRef<THREE.Group | null>(null);
  const surfaceGroupRef = useRef<THREE.Group | null>(null);
  const [farmPlots, setFarmPlots] = useState<FarmPlot[]>(() =>
    Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      stage: "empty" as FarmPlotStage,
      readyAt: null,
      fertilized: false,
    })),
  );
  const [farmNow, setFarmNow] = useState(() => Date.now());
  const [harvestCount, setHarvestCount] = useState(0);
  const [snapshot, setSnapshot] = useState<GameSnapshot>({
    soil: 0,
    storedSoil: 0,
    stage: "collect",
    nearSoilId: null,
    nearBase: false,
    nearDoor: false,
    insideBase: false,
    greenhouseBuilt: false,
    planted: false,
    speed: 0,
  });

  const nearSoil = useMemo(
    () => soilNodes.find((node) => node.id === snapshot.nearSoilId) ?? null,
    [snapshot.nearSoilId],
  );

  const enterBase = useCallback(() => {
    if (collectedRef.current.size < 3) return;
    storedSoilRef.current = collectedRef.current.size;
    insideBaseRef.current = true;
    inputRef.current.forward = 0;
    inputRef.current.turn = 0;
    if (surfaceGroupRef.current) surfaceGroupRef.current.visible = false;
    setSnapshot((prev) => ({
      ...prev,
      storedSoil: storedSoilRef.current,
      nearBase: false,
      nearDoor: false,
      insideBase: true,
      stage: plantedRef.current ? "complete" : "plant",
    }));
  }, []);

  const leaveBase = useCallback(() => {
    insideBaseRef.current = false;
    if (surfaceGroupRef.current) surfaceGroupRef.current.visible = true;
    setSnapshot((prev) => ({
      ...prev,
      insideBase: false,
      stage: plantedRef.current ? "complete" : "return",
    }));
  }, []);

  const performFarmAction = useCallback(
    (plotId: number, action: FarmAction) => {
      if (storedSoilRef.current < 3) return;
      const plot = farmPlots.find((item) => item.id === plotId);
      if (!plot) return;

      const canRun =
        (plot.stage === "empty" && action === "plant") ||
        (plot.stage === "sprout" && action === "water") ||
        (plot.stage === "watered" && action === "fertilize" && !plot.fertilized) ||
        (plot.stage === "mature" && action === "harvest");
      if (!canRun) return;

      const now = Date.now();
      const nextStage: FarmPlotStage =
        action === "plant" ? "seed" : action === "water" ? "watered" : action === "fertilize" ? "watered" : "empty";

      setFarmPlots((prev) =>
        prev.map((item) => {
          if (item.id !== plotId) return item;
          if (action === "plant") {
            return { ...item, stage: nextStage, readyAt: now + FARM_SEED_MS, fertilized: false };
          }
          if (action === "water") {
            return { ...item, stage: nextStage, readyAt: now + FARM_WATERED_MS, fertilized: false };
          }
          if (action === "fertilize") {
            return {
              ...item,
              readyAt: Math.min(item.readyAt ?? now + FARM_FERTILIZED_MS, now + FARM_FERTILIZED_MS),
              fertilized: true,
            };
          }
          return { ...item, stage: nextStage, readyAt: null, fertilized: false };
        }),
      );

      if (action === "plant") {
        plantedRef.current = true;
        if (greenhouseRef.current) greenhouseRef.current.visible = true;
        setSnapshot((prev) => ({
          ...prev,
          planted: true,
          greenhouseBuilt: true,
          stage: "complete",
        }));
      }

      if (action === "harvest") {
        setHarvestCount((count) => count + 1);
      }
    },
    [farmPlots],
  );

  const plantGarden = useCallback(() => {
    const target = farmPlots.find((plot) => plot.stage === "empty") ?? farmPlots.find((plot) => plot.stage !== "mature") ?? farmPlots[0];
    if (target) {
      performFarmAction(target.id, "plant");
    }
  }, [performFarmAction, farmPlots]);

  async function requestLandscapeMode() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {}

    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: "landscape" | "portrait") => Promise<void>;
      };
      if (orientation.lock) {
        await orientation.lock("landscape");
      }
    } catch {
      // Some mobile browsers reject orientation lock unless installed as PWA or fullscreen.
    } finally {
      window.dispatchEvent(new Event("resize"));
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setFarmNow(now);
      setFarmPlots((prev) =>
        prev.map((plot) => {
          if (!plot.readyAt || now < plot.readyAt) return plot;
          if (plot.stage === "seed") {
            return { ...plot, stage: "sprout", readyAt: null };
          }
          if (plot.stage === "watered") {
            return { ...plot, stage: "mature", readyAt: null };
          }
          return plot;
        }),
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#02040a");
    scene.fog = new THREE.Fog("#02040a", 18, 46);

    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 120);
    camera.position.set(0, 2.5, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const soilPickables: THREE.Object3D[] = [];
    const soilMeshes = new Map<string, THREE.Group>();
    const doorPickables: THREE.Object3D[] = [];
    const surfaceGroup = new THREE.Group();
    scene.add(surfaceGroup);
    surfaceGroupRef.current = surfaceGroup;
    const groundHeightAt = (x: number, z: number) => terrainHeight(x, z);

    const collectSoilById = (soilId: string) => {
      const node = soilNodes.find((item) => item.id === soilId);
      const rover = roverRef.current;
      if (!node || !rover || collectedRef.current.has(soilId)) return false;
      if (distance2D(rover.position, node.position) > SOIL_COLLECTION_DISTANCE) return false;
      collectedRef.current.add(soilId);
      return true;
    };

    const handleSceneTap = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      if (insideBaseRef.current) {
        return;
      }

      const soilHit = raycaster.intersectObjects(soilPickables, true).find((hit) => findUserData<string>(hit.object, "soilId"));
      let soilId = soilHit ? findUserData<string>(soilHit.object, "soilId") : null;
      if (!soilId) {
        let nearestDistance = SOIL_TAP_RADIUS_PX;
        soilMeshes.forEach((marker, id) => {
          if (collectedRef.current.has(id)) return;
          const projected = marker.getWorldPosition(new THREE.Vector3()).project(camera);
          if (projected.z < -1 || projected.z > 1) return;
          const screenX = rect.left + ((projected.x + 1) * rect.width) / 2;
          const screenY = rect.top + ((1 - projected.y) * rect.height) / 2;
          const distance = Math.hypot(event.clientX - screenX, event.clientY - screenY);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            soilId = id;
          }
        });
      }
      if (soilId && collectSoilById(soilId)) {
        updateSnapshot(roverRef.current!);
        return;
      }

      const doorHit = raycaster.intersectObjects(doorPickables, true)[0];
      if (doorHit && roverRef.current && collectedRef.current.size >= 3 && distance2D(roverRef.current.position, baseDoorWorldPosition()) < 2.25) {
        enterBase();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== undefined && event.button !== 0) return;
      const view = cameraViewRef.current;
      view.dragging = true;
      view.pointerId = event.pointerId;
      view.lastX = event.clientX;
      view.lastY = event.clientY;
      view.startX = event.clientX;
      view.startY = event.clientY;
      view.moved = false;
      renderer.domElement.style.cursor = "grabbing";
      renderer.domElement.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      const view = cameraViewRef.current;
      if (!view.dragging || view.pointerId !== event.pointerId) return;
      const dx = event.clientX - view.lastX;
      const dy = event.clientY - view.lastY;
      view.lastX = event.clientX;
      view.lastY = event.clientY;
      if (Math.abs(event.clientX - view.startX) + Math.abs(event.clientY - view.startY) > 14) {
        view.moved = true;
      }
      view.yawOffset -= dx * 0.0028;
      view.lookHeight = THREE.MathUtils.clamp(view.lookHeight - dy * 0.009, -0.2, 5.2);
    };

    const onPointerUp = (event: PointerEvent) => {
      const view = cameraViewRef.current;
      if (view.pointerId !== event.pointerId) return;
      const wasTap = !view.moved;
      view.dragging = false;
      view.pointerId = -1;
      renderer.domElement.style.cursor = "grab";
      try {
        renderer.domElement.releasePointerCapture(event.pointerId);
      } catch {}
      if (wasTap) {
        handleSceneTap(event);
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);

    scene.add(new THREE.AmbientLight("#4b5870", 0.33));
    const sun = new THREE.DirectionalLight("#fff4df", 4.2);
    sun.position.set(-10, 9, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 35;
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    scene.add(sun);

    const starSide = new THREE.PointLight("#8bbcff", 1.1, 24);
    starSide.position.set(12, 5, -10);
    scene.add(starSide);

    const textureLoader = new THREE.TextureLoader();
    const groundTexture = textureLoader.load("/assets/textures/nasa/moon_surface_color_2k.jpg");
    const groundHeightTexture = textureLoader.load("/assets/textures/nasa/moon_surface_height_1k.jpg");
    configureSurfaceTexture(groundTexture, renderer, true, 9);
    configureSurfaceTexture(groundHeightTexture, renderer, false, 9);
    const earthTexture = textureLoader.load("/assets/textures/nasa/earth_blue_marble_2k.png");
    configureSurfaceTexture(earthTexture, renderer, true, 1);

    const terrain = createTerrain(groundTexture, groundHeightTexture);
    surfaceGroup.add(terrain);

    const stars = createStarField();
    scene.add(stars);

    const earth = createEarth(earthTexture);
    earth.position.set(-15, 10.5, -30);
    surfaceGroup.add(earth);
    const earthKeyLight = new THREE.PointLight("#b9ddff", 3.2, 14);
    earthKeyLight.position.copy(earth.position).add(new THREE.Vector3(4, 5, 6));
    surfaceGroup.add(earthKeyLight);

    const earthSatelliteOrbit = new THREE.Group();
    earthSatelliteOrbit.position.copy(earth.position);
    surfaceGroup.add(earthSatelliteOrbit);
    const earthSatellite = new THREE.Group();
    earthSatellite.position.set(1.7, 0.35, 0);
    earthSatelliteOrbit.add(earthSatellite);
    loadNasaModel(earthSatellite, "/assets/models/nasa/lunar_reconnaissance_orbiter.glb", 0.62, 0);

    const lunarRelayOrbit = new THREE.Group();
    lunarRelayOrbit.position.set(-3.5, 5.2, -13.5);
    surfaceGroup.add(lunarRelayOrbit);
    const lunarRelay = new THREE.Group();
    lunarRelay.position.set(1.4, 0.2, 0);
    lunarRelayOrbit.add(lunarRelay);
    loadNasaModel(lunarRelay, "/assets/models/nasa/lunar_reconnaissance_orbiter.glb", 0.42, 0);

    const base = new THREE.Group();
    base.visible = false;
    base.position.set(0, terrainHeight(0, 0), 0);
    surfaceGroup.add(base);
    base.add(createBaseDoor());
    doorPickables.push(...findActionObjects(base, "base-door"));
    loadNasaModel(base, "/assets/models/nasa/apollo_lunar_module.glb", 4.8, 0.12);

    const rocket = new THREE.Group();
    rocket.visible = false;
    rocket.position.set(-7.5, groundHeightAt(-7.5, -8.5), -8.5);
    surfaceGroup.add(rocket);
    loadNasaModel(rocket, "/assets/models/nasa/saturn_v.glb", 3.8, 0.03);

    const baseDoorWorldPosition = () => {
      const door = doorPickables[0];
      const position = new THREE.Vector3(0, groundHeightAt(0, 0) + 0.55, 1.48);
      if (door) {
        door.getWorldPosition(position);
      }
      return position;
    };

    const greenhouse = createGreenhouse();
    greenhouse.visible = false;
    greenhouse.position.set(2.2, groundHeightAt(2.2, -0.7), -0.7);
    surfaceGroup.add(greenhouse);
    greenhouseRef.current = greenhouse;

    soilNodes.forEach((node) => {
      const marker = createSoilMarker();
      marker.position.copy(node.position);
      marker.position.y = groundHeightAt(node.position.x, node.position.z) + getGroundOffset(marker);
      marker.traverse((child) => {
        child.userData.soilId = node.id;
      });
      soilPickables.push(...marker.children);
      soilMeshes.set(node.id, marker);
      surfaceGroup.add(marker);
    });

    // Keep the vehicle invisible until the real NASA model has finished loading.
    const rover = new THREE.Group();
    rover.visible = false;
    rover.position.set(-1.8, groundHeightAt(-1.8, 3.8) + ROVER_GROUND_OFFSET, 3.8);
    rover.rotation.y = -0.25;
    surfaceGroup.add(rover);
    roverRef.current = rover;
    loadNasaRoverModel(rover);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      const portraitPhone = width <= 600 && height > width;
      camera.aspect = width / Math.max(height, 1);
      camera.fov = portraitPhone ? 70 : 60;
      cameraViewRef.current.distance = portraitPhone ? 5.2 : 4.7;
      cameraViewRef.current.height = portraitPhone ? 2.7 : 2.45;
      cameraViewRef.current.lookHeight = portraitPhone ? 0.45 : 0.55;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    positionCameraBehindRover(rover, camera, cameraViewRef.current, true);

    const clock = new THREE.Clock();
    let animationId = 0;
    let snapshotFrame = 0;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (!insideBaseRef.current) {
        updateRover(rover, camera, dt, inputRef.current, cameraViewRef.current, groundHeightAt);
      }
      stars.rotation.y += 0.00018;
      earth.rotation.y += 0.0018;
      earthSatelliteOrbit.rotation.y += 0.0022;
      earthSatellite.rotation.x += 0.004;
      lunarRelayOrbit.rotation.y -= 0.0014;
      lunarRelay.rotation.z += 0.003;
      soilMeshes.forEach((mesh, id) => {
        mesh.rotation.y += 0.015;
        mesh.visible = !collectedRef.current.has(id);
      });
      snapshotFrame += 1;
      if (snapshotFrame % 6 === 0) {
        updateSnapshot(rover);
      }
      renderer.render(scene, camera);
    };
    animate();

    function updateSnapshot(currentRover: THREE.Group) {
      const pos = currentRover.position;
      const near = soilNodes.find(
        (node) => !collectedRef.current.has(node.id) && distance2D(pos, node.position) < SOIL_COLLECTION_DISTANCE,
      );
      const nearBase = distance2D(pos, base.position) < 2.1;
      const nearDoor = distance2D(pos, baseDoorWorldPosition()) < 2.25;
      const soil = collectedRef.current.size;
      const storedSoil = storedSoilRef.current;
      const greenhouseBuilt = greenhouse.visible;
      const stage: MissionStage = plantedRef.current
        ? "complete"
        : insideBaseRef.current
        ? "plant"
        : soil >= 3 && nearDoor
        ? "deposit"
        : soil >= 3
        ? "return"
        : "collect";
      setSnapshot({
        soil,
        storedSoil,
        stage,
        nearSoilId: near?.id ?? null,
        nearBase,
        nearDoor,
        insideBase: insideBaseRef.current,
        greenhouseBuilt,
        planted: plantedRef.current,
        speed: Math.abs(inputRef.current.forward),
      });
    }

    return () => {
      cancelAnimationFrame(animationId);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.dispose();
      renderer.domElement.remove();
      groundTexture.dispose();
      groundHeightTexture.dispose();
      earthTexture.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      roverRef.current = null;
      greenhouseRef.current = null;
      surfaceGroupRef.current = null;
    };
  }, [enterBase]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "w" || event.key === "ArrowUp") inputRef.current.forward = 1;
      if (event.key === "s" || event.key === "ArrowDown") inputRef.current.forward = -0.65;
      if (event.key === "a" || event.key === "ArrowLeft") inputRef.current.turn = 1;
      if (event.key === "d" || event.key === "ArrowRight") inputRef.current.turn = -1;
    };
    const up = (event: KeyboardEvent) => {
      if (["w", "s", "ArrowUp", "ArrowDown"].includes(event.key)) inputRef.current.forward = 0;
      if (["a", "d", "ArrowLeft", "ArrowRight"].includes(event.key)) inputRef.current.turn = 0;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  function setDriveAxis(axis: "forward" | "turn", value: number) {
    inputRef.current[axis] = value;
  }

  function release() {
    inputRef.current.forward = 0;
    inputRef.current.turn = 0;
  }

  return (
    <div
      className="relative h-[calc(100svh-3rem)] min-h-[30rem] select-none overflow-hidden bg-black max-sm:landscape:min-h-0"
      onContextMenu={(event) => event.preventDefault()}
      style={{ WebkitTouchCallout: "none", userSelect: "none" }}
    >
      <style>{`
        @media (orientation: portrait) and (max-width: 600px) {
          .lunar-task-panel { bottom: 6.35rem; max-height: 18svh; padding: .55rem; }
          .lunar-task-panel .mission-copy { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 1; }
          .lunar-task-panel .task-help { display: none; }
          .lunar-task-panel .metric-cell { padding-top: .3rem; padding-bottom: .3rem; }
          .lunar-controls { bottom: .55rem; gap: .3rem; padding: .4rem; }
          .lunar-controls button { min-width: 3.05rem; height: 2.65rem; padding-left: .35rem; padding-right: .35rem; }
        }
        @media (orientation: landscape) and (max-width: 900px) {
          .lunar-task-panel { width: min(18rem, 32vw); max-height: calc(100svh - 4.75rem); padding: .75rem; }
          .lunar-controls { right: .75rem; bottom: .75rem; gap: .4rem; padding: .5rem; }
          .lunar-controls button { min-width: 3.25rem; height: 2.75rem; padding-left: .5rem; padding-right: .5rem; }
        }
      `}</style>
      <div ref={mountRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,228,176,0.13),transparent_32%,rgba(5,8,18,0.38)_76%,rgba(5,8,18,0.72))]" />

      {snapshot.insideBase && (
        <BaseFarmPanel
          plots={farmPlots}
          storedSoil={snapshot.storedSoil}
          harvestCount={harvestCount}
          now={farmNow}
          onPlotAction={performFarmAction}
          onLeave={leaveBase}
        />
      )}

      {!snapshot.insideBase && (
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 px-3 py-3 sm:px-4 sm:py-4">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href="/tools/body-map/moon" className="pointer-events-auto text-xs text-white/38 hover:text-white/70">
              返回 3D 月球地图
            </Link>
            <h1 className="mt-1 truncate text-lg font-semibold tracking-tight text-white/90 sm:mt-2 sm:text-2xl">月球车任务 Demo</h1>
            <p className="mt-1 hidden text-xs text-white/38 sm:block">
              着陆区：{landingSite.name}（{landingSite.lat}°, {landingSite.lon}°）· 采集 3 份月壤，返回基地，建成第一个种植舱。
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={requestLandscapeMode}
              className="pointer-events-auto rounded-md border border-white/10 bg-black/35 px-3 py-1.5 text-xs text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white/75 sm:hidden"
            >
              横屏
            </button>
          </div>
        </div>
      </header>
      )}

      {!snapshot.insideBase && (
      <section className="lunar-task-panel select-none absolute inset-x-3 bottom-[8.5rem] top-auto z-20 max-h-[30svh] overflow-y-auto rounded-xl border border-white/10 bg-black/50 p-3 backdrop-blur-md sm:bottom-auto sm:left-4 sm:right-auto sm:top-28 sm:max-h-none sm:w-[min(21rem,calc(100vw-2rem))] sm:p-4 max-sm:landscape:bottom-3 max-sm:landscape:left-3 max-sm:landscape:right-auto max-sm:landscape:max-h-[calc(100svh-5.75rem)] max-sm:landscape:w-[16rem]">
        <p className="text-xs text-white/25">任务状态</p>
        <div className="mt-2 hidden rounded-md bg-white/[0.045] px-3 py-2 sm:block">
          <p className="text-[10px] text-white/18">当前着陆区</p>
          <p className="mt-1 text-xs font-medium text-white/58">{landingSite.name}</p>
          <p className="mt-0.5 text-[10px] text-white/25">{landingSite.nameEn}</p>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Metric label="月壤" value={`${snapshot.soil}/3`} />
          <Metric label="基地仓" value={snapshot.storedSoil >= 3 ? "已入库" : snapshot.nearDoor ? "门口" : "未入库"} />
          <Metric label="种植" value={snapshot.planted ? "完成" : snapshot.insideBase ? "室内" : "未开始"} />
        </div>
        <p className="mission-copy mt-2 text-xs leading-relaxed text-white/42 sm:mt-3">
          {missionText(snapshot.stage)}
        </p>
        <div className="task-help mt-3 hidden rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs leading-relaxed text-white/36 sm:block">
          {snapshot.insideBase
            ? "基地内部：点击蓝色种植槽，或使用下方按钮种下第一批实验菜。"
            : nearSoil
            ? `靠近 ${nearSoil.name}，直接点击发光月壤完成采集。`
            : snapshot.nearDoor && snapshot.soil >= 3
            ? "样本已带回基地门口。点击基地门，或使用下方入口进入基地。"
            : "拖动画面调整视角，驾驶月球车靠近发光月壤样本。"}
        </div>
        <div className="mt-2 flex gap-2 sm:mt-3">
          {!snapshot.insideBase && (
            <button
              type="button"
              disabled={snapshot.soil < 3 || !snapshot.nearDoor}
              onClick={enterBase}
              className="flex-1 rounded-md bg-accent/18 px-3 py-2 text-xs font-medium text-accent transition-colors enabled:hover:bg-accent/26 disabled:cursor-not-allowed disabled:bg-white/[0.04] disabled:text-white/18"
            >
              进入基地门
            </button>
          )}
          {snapshot.insideBase && (
            <>
              <button
                type="button"
                disabled={snapshot.storedSoil < 3 || snapshot.planted}
                onClick={plantGarden}
                className="flex-1 rounded-md bg-accent/18 px-3 py-2 text-xs font-medium text-accent transition-colors enabled:hover:bg-accent/26 disabled:cursor-not-allowed disabled:bg-white/[0.04] disabled:text-white/18"
              >
                种下实验菜
              </button>
              <button
                type="button"
                onClick={leaveBase}
                className="flex-1 rounded-md bg-white/[0.08] px-3 py-2 text-xs font-medium text-white/55 transition-colors hover:bg-white/[0.12]"
              >
                返回月面
              </button>
            </>
          )}
        </div>
      </section>
      )}

      {!snapshot.insideBase && (
        <section className="lunar-controls absolute bottom-3 left-1/2 z-30 grid -translate-x-1/2 grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-black/50 p-2 backdrop-blur-md sm:bottom-4 sm:left-auto sm:right-4 sm:translate-x-0 sm:gap-2 sm:p-3 max-sm:landscape:left-auto max-sm:landscape:right-3 max-sm:landscape:translate-x-0">
        <ControlButton label="前进" onDown={() => setDriveAxis("forward", 1)} onUp={() => setDriveAxis("forward", 0)} className="col-start-2" />
        <ControlButton label="左转" onDown={() => setDriveAxis("turn", 1)} onUp={() => setDriveAxis("turn", 0)} className="col-start-1 row-start-2" />
        <ControlButton label="停" onDown={release} onUp={release} className="col-start-2 row-start-2" />
        <ControlButton label="右转" onDown={() => setDriveAxis("turn", -1)} onUp={() => setDriveAxis("turn", 0)} className="col-start-3 row-start-2" />
        <ControlButton label="后退" onDown={() => setDriveAxis("forward", -0.65)} onUp={() => setDriveAxis("forward", 0)} className="col-start-2 row-start-3" />
        </section>
      )}

      <div className="absolute bottom-4 left-4 z-20 hidden rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] text-white/30 backdrop-blur-md sm:block">
        键盘：W/S 前后，A/D 转向。鼠标或手指拖动场景可环绕视角。
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-cell rounded-md bg-white/[0.045] px-2 py-2">
      <p className="text-[10px] text-white/20">{label}</p>
      <p className="mt-1 text-sm font-medium text-white/65">{value}</p>
    </div>
  );
}

function ControlButton({
  label,
  onDown,
  onUp,
  className = "",
}: {
  label: string;
  onDown: () => void;
  onUp: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onDown();
      }}
      onPointerUp={(event) => {
        event.preventDefault();
        onUp();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
      onContextMenu={(event) => event.preventDefault()}
      aria-label={label}
      className={`h-12 min-w-[4rem] touch-none select-none rounded-md bg-white/[0.08] px-3 text-xs text-white/60 transition-colors hover:bg-white/[0.14] sm:h-11 sm:min-w-14 ${className}`}
    >
      {label}
    </button>
  );
}

function BaseFarmPanel({
  plots,
  storedSoil,
  harvestCount,
  now,
  onPlotAction,
  onLeave,
}: {
  plots: FarmPlot[];
  storedSoil: number;
  harvestCount: number;
  now: number;
  onPlotAction: (plotId: number, action: FarmAction) => void;
  onLeave: () => void;
}) {
  const [selectedPlotId, setSelectedPlotId] = useState(plots[0]?.id ?? 1);
  const [operatorPosition, setOperatorPosition] = useState(() => farmOperatorPosition(plots[0]?.id ?? 1));
  const [working, setWorking] = useState<{ plotId: number; action: FarmAction } | null>(null);
  const actionTimerRef = useRef<number | null>(null);
  const selectedPlot = plots.find((plot) => plot.id === selectedPlotId) ?? plots[0];
  const plantedCount = plots.filter((plot) => plot.stage !== "empty").length;
  const matureCount = plots.filter((plot) => plot.stage === "mature").length;
  const availableAction = selectedPlot ? farmAvailableAction(selectedPlot) : null;
  const selectedRemaining = selectedPlot ? farmRemainingSeconds(selectedPlot, now) : 0;

  useEffect(() => () => {
    if (actionTimerRef.current !== null) window.clearTimeout(actionTimerRef.current);
  }, []);

  function selectPlot(plotId: number) {
    if (working) return;
    setSelectedPlotId(plotId);
    setOperatorPosition(farmOperatorPosition(plotId));
  }

  function runAction(action: FarmAction) {
    if (!selectedPlot || availableAction !== action || working) return;
    const plotId = selectedPlot.id;
    setOperatorPosition(farmOperatorPosition(plotId));
    setWorking({ plotId, action });
    actionTimerRef.current = window.setTimeout(() => {
      onPlotAction(plotId, action);
      setWorking(null);
      actionTimerRef.current = null;
    }, 720);
  }

  return (
    <section className="absolute inset-0 z-40 overflow-hidden bg-[#03070c] text-cyan-50">
      <style>{`
        @keyframes farm-work-pulse { 0%,100% { opacity:.35; transform:scale(.72) } 50% { opacity:1; transform:scale(1.08) } }
        @keyframes farm-tool-sweep { 0%,100% { transform:rotate(-12deg) } 50% { transform:rotate(20deg) } }
        @keyframes farm-crop-breathe { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-2px) } }
        .farm-operator-working .farm-operator-arm { animation:farm-tool-sweep .36s ease-in-out infinite; transform-origin:top center }
        .farm-operator-working .farm-work-light { animation:farm-work-pulse .48s ease-in-out infinite }
        .farm-crop-growing { animation:farm-crop-breathe 2.4s ease-in-out infinite }
      `}</style>
      <main className="relative mx-auto h-full max-w-[92rem] overflow-hidden bg-[#0a151e]">
        <div className="relative h-full overflow-hidden bg-[radial-gradient(circle_at_50%_30%,rgba(117,210,226,0.18),transparent_31%),linear-gradient(180deg,#08131d_0%,#132b38_39%,#77868a_40%,#34444b_100%)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[42%] bg-[linear-gradient(180deg,rgba(1,8,14,0.96),rgba(16,47,62,0.82))]" />
            <div className="pointer-events-none absolute inset-x-[7%] top-[5%] h-[31%] overflow-hidden border border-cyan-100/25 bg-[#02050a] shadow-[0_0_38px_rgba(63,189,210,0.11),inset_0_0_20px_rgba(0,0,0,0.85)] [clip-path:polygon(4%_0,96%_0,100%_100%,0_100%)]">
              <img
                src="/assets/textures/nasa/moon_surface_color_2k.jpg"
                alt="月面任务区"
                className="absolute inset-x-0 bottom-0 h-[58%] w-full object-cover object-[center_62%] opacity-80 grayscale"
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(255,255,255,0.08),transparent_26%),linear-gradient(180deg,#01040a_0%,rgba(4,9,16,0.58)_57%,rgba(3,9,14,0.08)_100%)]" />
              <div
                className="absolute right-[13%] top-[12%] h-9 w-9 rounded-full bg-cover bg-center shadow-[0_0_25px_rgba(125,211,252,0.65)] sm:h-12 sm:w-12"
                style={{ backgroundImage: "url('/assets/textures/nasa/earth_blue_marble_2k.png')" }}
              />
              <div className="absolute bottom-[13%] left-[16%] h-3 w-10 rounded-sm bg-slate-800/90 shadow-[0_5px_12px_rgba(0,0,0,0.7)] sm:h-4 sm:w-14">
                <span className="absolute -left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-slate-500 bg-slate-950 sm:h-3 sm:w-3" />
                <span className="absolute -right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-slate-500 bg-slate-950 sm:h-3 sm:w-3" />
                <span className="absolute bottom-full left-1/2 h-3 w-1 -translate-x-1/2 bg-slate-500" />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-[34%] h-5 bg-[linear-gradient(180deg,#88a1a9,#344a54_45%,#10202a_50%,#36515b)] shadow-[0_8px_24px_rgba(0,0,0,0.45)]" />
            <div className="pointer-events-none absolute inset-x-[2%] bottom-0 h-[66%] [clip-path:polygon(10%_0,90%_0,100%_100%,0_100%)] bg-[repeating-linear-gradient(90deg,rgba(205,239,245,0.055)_0_1px,transparent_1px_8%),repeating-linear-gradient(0deg,rgba(205,239,245,0.05)_0_1px,transparent_1px_18%),linear-gradient(180deg,#839397_0%,#52636a_42%,#26353c_100%)] shadow-[inset_0_30px_54px_rgba(222,247,250,0.13)]" />
            <div className="pointer-events-none absolute bottom-0 left-1/2 h-[58%] w-[28%] -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(132,225,235,0.12),transparent)] [clip-path:polygon(41%_0,59%_0,100%_100%,0_100%)]" />

            <div className="pointer-events-none absolute left-3 top-3 z-50 flex max-w-[calc(100%-5rem)] items-center gap-3 border-l-2 border-cyan-300/75 bg-slate-950/55 px-3 py-2 shadow-lg backdrop-blur-md sm:left-5 sm:top-5 sm:gap-5 sm:px-4">
              <div>
                <p className="text-[9px] tracking-[0.22em] text-cyan-200/55 sm:text-[10px]">LUNAR GREENHOUSE</p>
                <p className="mt-0.5 text-xs font-medium text-cyan-50 sm:text-sm">地块 #{selectedPlot?.id ?? "-"} · {selectedPlot ? farmPlotLabel(selectedPlot, now) : "未选择"}</p>
              </div>
              <div className="hidden items-center gap-4 text-[11px] text-cyan-100/62 min-[520px]:flex sm:text-xs">
                <span>月壤 <b className="text-white">{storedSoil}/3</b></span>
                <span>种植 <b className="text-white">{plantedCount}/12</b></span>
                <span>收获 <b className="text-white">{harvestCount}</b></span>
                <span className="text-lime-200">成熟 <b>{matureCount}</b></span>
              </div>
            </div>

            <button
              type="button"
              onClick={onLeave}
              className="absolute right-3 top-3 z-50 flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-100/25 bg-slate-950/60 text-[10px] font-medium text-cyan-50 shadow-lg backdrop-blur-md transition-colors hover:bg-cyan-950/70 sm:right-5 sm:top-5 sm:h-auto sm:w-auto sm:px-3 sm:py-2 sm:text-xs"
            >
              <span className="sm:hidden">舱外</span>
              <span className="hidden sm:inline">返回月面任务</span>
            </button>

            <div className="pointer-events-none absolute left-[3%] top-[38%] z-20 h-[30%] w-[17%] border border-cyan-100/24 bg-[linear-gradient(135deg,rgba(32,69,83,0.96),rgba(9,25,35,0.96))] shadow-[inset_-12px_0_30px_rgba(34,211,238,0.08),6px_12px_20px_rgba(0,0,0,0.3)] [clip-path:polygon(0_8%,78%_0,100%_100%,0_92%)]">
              <div className="absolute inset-x-[22%] top-[17%] h-[54%] rounded-t-full border border-cyan-200/45 bg-[linear-gradient(180deg,rgba(91,204,221,0.32),rgba(5,17,25,0.82))]" />
              <div className="absolute inset-x-[18%] bottom-[13%] h-1 bg-cyan-300/55 shadow-[0_0_12px_rgba(103,232,249,0.8)]" />
            </div>
            <div className="pointer-events-none absolute right-[3%] top-[40%] z-20 h-[28%] w-[15%] border border-cyan-100/20 bg-[linear-gradient(145deg,rgba(183,221,226,0.22),rgba(9,29,39,0.76))] shadow-[inset_0_0_26px_rgba(103,232,249,0.11),-6px_12px_20px_rgba(0,0,0,0.28)]">
              <div className="absolute inset-x-[18%] top-[12%] h-1.5 bg-cyan-100/60" />
              <div className="absolute bottom-[13%] left-[17%] h-[48%] w-[24%] rounded-t-full border border-cyan-100/25 bg-cyan-300/15" />
              <div className="absolute bottom-[13%] right-[17%] h-[48%] w-[24%] rounded-t-full border border-lime-100/25 bg-lime-300/10" />
            </div>

            {plots.map((plot) => (
              <button
                key={plot.id}
                type="button"
                aria-label={`选择 ${plot.id} 号种植床，${farmPlotLabel(plot, now)}`}
                aria-pressed={selectedPlotId === plot.id}
                disabled={Boolean(working)}
                onClick={() => selectPlot(plot.id)}
                className="absolute h-14 w-[4.6rem] -translate-x-1/2 -translate-y-1/2 touch-manipulation border-0 bg-transparent p-0 outline-none transition-[filter] enabled:hover:brightness-110 focus-visible:ring-2 focus-visible:ring-cyan-200 sm:h-[5.1rem] sm:w-28"
                style={{
                  left: `${farmPlotPosition(plot.id).x}%`,
                  top: `${farmPlotPosition(plot.id).y}%`,
                  transform: `translate(-50%, -50%) scale(${farmPlotPosition(plot.id).scale})`,
                  zIndex: farmPlotPosition(plot.id).z,
                }}
              >
                <span
                  className={`absolute inset-x-0 top-0 h-[64%] rounded-t-lg border shadow-[inset_0_8px_14px_rgba(255,255,255,0.18),0_8px_12px_rgba(0,0,0,0.25)] ${farmPlotTopClass(plot.stage)} ${selectedPlotId === plot.id ? "ring-2 ring-cyan-200 ring-offset-2 ring-offset-[#35474e]" : ""}`}
                  style={{ transform: "perspective(240px) rotateX(61deg)", transformOrigin: "bottom center" }}
                />
                <span className={`absolute inset-x-[4%] bottom-[17%] h-[43%] rounded-b-lg border-x border-b shadow-lg ${farmPlotFaceClass(plot.stage)}`} />
                <span className="absolute left-1/2 top-[6%] -translate-x-1/2 -translate-y-[68%]">
                  <FarmCropVisual stage={plot.stage} />
                </span>
                {farmRemainingSeconds(plot, now) > 0 && (
                  <span className="absolute bottom-[20%] left-1/2 -translate-x-1/2 rounded-md bg-black/68 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-50 shadow-sm sm:text-[10px]">
                    {farmRemainingSeconds(plot, now)}s
                  </span>
                )}
                <span className={`absolute -right-1 bottom-[24%] h-2 w-2 rounded-full ${plot.stage === "mature" ? "bg-lime-300 shadow-[0_0_8px_#bef264]" : plot.stage === "empty" ? "bg-white/25" : "bg-cyan-300 shadow-[0_0_7px_#67e8f9]"}`} />
              </button>
            ))}

            <div
              className={`absolute h-14 w-10 -translate-x-1/2 -translate-y-full transition-all duration-700 ease-[cubic-bezier(.2,.8,.2,1)] sm:h-[4.5rem] sm:w-12 ${working ? "farm-operator-working" : ""}`}
              style={{ left: `${operatorPosition.x}%`, top: `${operatorPosition.y}%`, zIndex: operatorPosition.z }}
            >
              <div className="farm-work-light absolute -inset-3 rounded-full bg-cyan-300/20 opacity-0 blur-md" />
              <div className="absolute left-1/2 top-0 h-6 w-7 -translate-x-1/2 rounded-md border border-cyan-100/55 bg-[linear-gradient(180deg,#eefcff,#7ab8ca)] shadow-[0_0_10px_rgba(165,243,252,0.35)] sm:h-8 sm:w-9">
                <span className="absolute inset-x-[18%] top-[28%] h-[30%] rounded-sm bg-[#102c3c] shadow-[inset_0_0_5px_rgba(103,232,249,0.8)]" />
              </div>
              <div className="absolute left-1/2 top-5 h-7 w-8 -translate-x-1/2 rounded-md border border-slate-300/50 bg-[linear-gradient(135deg,#d8e5e8,#3c7184)] shadow-md sm:top-7 sm:h-8 sm:w-10" />
              <div className="farm-operator-arm absolute right-0 top-7 h-7 w-1.5 rounded-full bg-cyan-100/80 shadow-[0_0_5px_rgba(103,232,249,0.7)] sm:top-9" />
              <div className="absolute bottom-0 left-1.5 h-4 w-2 rounded-b bg-slate-800 sm:h-5 sm:w-2.5" />
              <div className="absolute bottom-0 right-1.5 h-4 w-2 rounded-b bg-slate-800 sm:h-5 sm:w-2.5" />
            </div>

            <div className="absolute inset-x-2 bottom-2 z-[70] grid min-h-[4.2rem] grid-cols-[minmax(0,1fr)_6rem] items-center gap-3 rounded-lg border border-cyan-100/20 bg-[#07121b]/90 px-3 py-2 shadow-[0_-10px_30px_rgba(0,0,0,0.28)] backdrop-blur-md sm:bottom-5 sm:left-1/2 sm:right-auto sm:w-[min(38rem,calc(100%-2rem))] sm:-translate-x-1/2 sm:grid-cols-[minmax(0,1fr)_7rem] sm:px-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />
                  <p className="truncate text-xs font-semibold text-white sm:text-sm">{working ? `${farmActionLabel(working.action)}中` : `地块 #${selectedPlot?.id ?? "-"}`}</p>
                </div>
                <p className="mt-1 truncate text-[10px] text-cyan-100/55 sm:text-xs">
                  {working
                    ? "作业机器人正在执行指令"
                    : selectedRemaining > 0
                      ? `剩余 ${selectedRemaining} 秒`
                      : selectedPlot
                        ? farmPlotLabel(selectedPlot, now)
                        : "选择一个种植床"}
                </p>
              </div>
              <FarmActionButton
                action={availableAction}
                working={Boolean(working)}
                onClick={() => availableAction && runAction(availableAction)}
              />
            </div>
        </div>
      </main>
    </section>
  );
}

function FarmActionButton({
  action,
  working,
  onClick,
}: {
  action: FarmAction | null;
  working: boolean;
  onClick: () => void;
}) {
  const label = working ? "执行中" : action ? farmActionLabel(action) : "生长中";
  return (
    <button
      type="button"
      disabled={!action || working}
      onClick={onClick}
      className="h-11 w-full min-w-0 touch-manipulation rounded-lg border border-cyan-200/55 bg-cyan-500/90 px-3 text-xs font-semibold text-[#03131a] shadow-[0_0_18px_rgba(34,211,238,0.2)] transition-colors enabled:hover:bg-cyan-300 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.06] disabled:text-white/30 sm:px-4 sm:text-sm"
    >
      {label}
    </button>
  );
}

function farmPlotPosition(plotId: number) {
  const positions = [
    { x: 25, y: 78, scale: 1.08, z: 44 },
    { x: 43, y: 78, scale: 1.08, z: 45 },
    { x: 61, y: 78, scale: 1.08, z: 46 },
    { x: 79, y: 78, scale: 1.08, z: 47 },
    { x: 30, y: 64, scale: 0.91, z: 34 },
    { x: 46, y: 64, scale: 0.91, z: 35 },
    { x: 62, y: 64, scale: 0.91, z: 36 },
    { x: 77, y: 64, scale: 0.91, z: 37 },
    { x: 36, y: 52, scale: 0.74, z: 24 },
    { x: 50, y: 52, scale: 0.74, z: 25 },
    { x: 64, y: 52, scale: 0.74, z: 26 },
    { x: 77, y: 52, scale: 0.74, z: 27 },
  ];
  return positions[plotId - 1] ?? positions[0];
}

function farmOperatorPosition(plotId: number) {
  const plot = farmPlotPosition(plotId);
  return {
    x: Math.max(14, plot.x - 8.5 * plot.scale),
    y: Math.min(86, plot.y + 8 * plot.scale),
    z: plot.z + 12,
  };
}

function farmAvailableAction(plot: FarmPlot): FarmAction | null {
  if (plot.stage === "empty") return "plant";
  if (plot.stage === "sprout") return "water";
  if (plot.stage === "watered" && !plot.fertilized) return "fertilize";
  if (plot.stage === "watered") return null;
  if (plot.stage === "mature") return "harvest";
  return null;
}

function farmRemainingSeconds(plot: FarmPlot, now: number) {
  if (!plot.readyAt) return 0;
  return Math.max(0, Math.ceil((plot.readyAt - now) / 1000));
}

function farmActionLabel(action: FarmAction) {
  if (action === "plant") return "播种";
  if (action === "water") return "浇水";
  if (action === "fertilize") return "施肥";
  return "收获";
}

function farmPlotTopClass(stage: FarmPlotStage) {
  if (stage === "mature") return "border-emerald-200/80 bg-[linear-gradient(180deg,#e7fff2_0%,#82efbe_52%,#35b979_100%)]";
  if (stage === "watered") return "border-lime-200/80 bg-[linear-gradient(180deg,#f3ffd9_0%,#c7f36d_55%,#83bd35_100%)]";
  if (stage === "sprout") return "border-green-200/80 bg-[linear-gradient(180deg,#ecffc8_0%,#9be878_55%,#4fac52_100%)]";
  if (stage === "seed") return "border-sky-200/80 bg-[linear-gradient(180deg,#ecfbff_0%,#99d7f7_52%,#4a9bd0_100%)]";
  return "border-amber-200/55 bg-[linear-gradient(180deg,#d79a62_0%,#a8693c_58%,#704022_100%)]";
}

function farmPlotFaceClass(stage: FarmPlotStage) {
  if (stage === "mature") return "border-emerald-900/25 bg-[linear-gradient(180deg,#39b87d_0%,#176642_100%)]";
  if (stage === "watered") return "border-lime-900/25 bg-[linear-gradient(180deg,#8fc742_0%,#526f23_100%)]";
  if (stage === "sprout") return "border-green-900/25 bg-[linear-gradient(180deg,#56b25b_0%,#2f6734_100%)]";
  if (stage === "seed") return "border-sky-900/25 bg-[linear-gradient(180deg,#4fa7d4_0%,#255a7b_100%)]";
  return "border-amber-950/35 bg-[linear-gradient(180deg,#965b32_0%,#5a351f_100%)]";
}

function farmPlotLabel(plot: FarmPlot, now: number) {
  const remaining = farmRemainingSeconds(plot, now);
  if (plot.stage === "mature") return "成熟，可收获";
  if (plot.stage === "watered") {
    return remaining > 0 ? `成熟倒计时 ${remaining}s${plot.fertilized ? "（已施肥）" : ""}` : "等待成熟";
  }
  if (plot.stage === "sprout") return "幼苗，可浇水";
  if (plot.stage === "seed") return remaining > 0 ? `发芽倒计时 ${remaining}s` : "正在发芽";
  return "空地块，可种植";
}

function FarmCropVisual({ stage }: { stage: FarmPlotStage }) {
  if (stage === "empty") return null;
  if (stage === "seed") {
    return (
      <div className="flex gap-2">
        <span className="h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_6px_rgba(190,242,100,0.7)]" />
        <span className="h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_6px_rgba(190,242,100,0.7)]" />
        <span className="h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_6px_rgba(190,242,100,0.7)]" />
      </div>
    );
  }
  if (stage === "sprout") {
    return (
      <div className="flex items-end gap-1.5">
        <FarmPlant size="small" />
        <FarmPlant size="small" delay=".35s" />
        <FarmPlant size="small" delay=".7s" />
      </div>
    );
  }
  if (stage === "watered") {
    return (
      <div className="flex items-end gap-1.5">
        <FarmPlant size="medium" />
        <FarmPlant size="medium" delay=".3s" />
        <FarmPlant size="medium" delay=".6s" />
      </div>
    );
  }
  return (
    <div className="flex items-end gap-1">
      <FarmPlant size="large" fruit />
      <FarmPlant size="large" fruit delay=".3s" />
      <FarmPlant size="large" fruit delay=".6s" />
    </div>
  );
}

function FarmPlant({
  size,
  fruit = false,
  delay = "0s",
}: {
  size: "small" | "medium" | "large";
  fruit?: boolean;
  delay?: string;
}) {
  const dimensions = size === "small" ? "h-7 w-5" : size === "medium" ? "h-10 w-7" : "h-12 w-8";
  return (
    <span className={`farm-crop-growing relative block ${dimensions}`} style={{ animationDelay: delay }}>
      <span className="absolute bottom-0 left-1/2 h-[78%] w-1 -translate-x-1/2 rounded-full bg-emerald-700" />
      <span className="absolute bottom-[35%] left-0 h-[34%] w-[72%] -rotate-[18deg] rounded-full bg-lime-400 shadow-[inset_0_1px_2px_rgba(255,255,255,0.3)]" />
      <span className="absolute bottom-[48%] right-0 h-[32%] w-[70%] rotate-[18deg] rounded-full bg-emerald-400 shadow-[inset_0_1px_2px_rgba(255,255,255,0.25)]" />
      {fruit && <span className="absolute left-1/2 top-0 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-amber-300 shadow-[0_0_7px_rgba(253,224,71,0.65)]" />}
    </span>
  );
}

function missionText(stage: MissionStage) {
  if (stage === "complete") return "第一批实验菜已经进入生长舱，月面基地完成从采样、入库到种植的闭环。";
  if (stage === "plant") return "月壤样本已经放入基地仓。点击蓝色种植槽，把样本转化为第一批实验种植基质。";
  if (stage === "deposit") return "月壤样本已带回基地门口。点击基地门进入内部，系统会自动完成样本入库。";
  if (stage === "return") return "3 份月壤已经采齐。驾驶月球车返回基地门口，把样本放入基地仓。";
  return "驾驶月球车靠近发光采集点，然后直接点击发光月壤采集样本。";
}

function configureSurfaceTexture(
  texture: THREE.Texture,
  renderer: THREE.WebGLRenderer,
  isColor: boolean,
  repeat: number,
) {
  if (isColor) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
}

function createTerrain(groundTexture: THREE.Texture, groundHeightTexture: THREE.Texture) {
  const size = 58;
  const segments = 156;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    positions.setY(i, terrainHeight(x, z));
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    color: "#aaa39a",
    map: groundTexture,
    bumpMap: groundHeightTexture,
    bumpScale: 0.075,
    roughness: 1,
    metalness: 0,
  });
  const terrain = new THREE.Mesh(geometry, material);
  terrain.receiveShadow = true;
  return terrain;
}

function loadNasaRoverModel(rover: THREE.Group) {
  loadNasaModel(rover, "/assets/models/nasa/perseverance_rover.glb", 1.65, 0, (model) => {
    setupRoverWheelAnimation(rover, model);
  });
}

function loadNasaModel(
  parent: THREE.Group,
  path: string,
  maxSize: number,
  lift: number,
  onLoaded?: (model: THREE.Object3D) => void,
) {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("/assets/three/draco/");
  dracoLoader.setDecoderConfig({ type: "wasm" });
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  loader.load(
    path,
    (gltf) => {
      const normalized = normalizeNasaModel(gltf.scene, maxSize, lift);
      parent.add(normalized);
      onLoaded?.(normalized);
      parent.visible = true;
      dracoLoader.dispose();
    },
    undefined,
    () => {
      parent.visible = false;
      dracoLoader.dispose();
    },
  );
}

function setupRoverWheelAnimation(rover: THREE.Group, model: THREE.Object3D) {
  const wheelCandidates: THREE.Object3D[] = [];
  model.traverse((object) => {
    if (object.name === "Wheels_objs") wheelCandidates.push(object);
  });
  const wheelMesh = wheelCandidates[0] as THREE.Mesh | undefined;
  if (!wheelMesh?.geometry) return;

  const position = wheelMesh.geometry.getAttribute("position") as THREE.BufferAttribute;
  const originalPositions = new Float32Array(position.array as ArrayLike<number>);
  const wheelCenters = [-1.05, 1.05].flatMap((x) => [-1.1, 0, 1.1].map((z) => ({ x, z })));
  const bounds = new THREE.Box3().setFromBufferAttribute(position);

  rover.userData.wheelAnimation = {
    mesh: wheelMesh,
    position,
    originalPositions,
    wheelCenters,
    centerY: (bounds.min.y + bounds.max.y) * 0.5,
    wheelRadius: 0.25,
    angle: 0,
  };
}

function animateRoverWheels(rover: THREE.Group, distance: number) {
  if (Math.abs(distance) < 0.000001) return;
  const animation = rover.userData.wheelAnimation as
    | {
        mesh: THREE.Mesh;
        position: THREE.BufferAttribute;
        originalPositions: Float32Array;
        wheelCenters: Array<{ x: number; z: number }>;
        centerY: number;
        wheelRadius: number;
        angle: number;
      }
    | undefined;
  if (!animation) return;

  animation.angle -= distance / animation.wheelRadius;
  const { position, originalPositions, wheelCenters, centerY } = animation;
  for (let index = 0; index < position.count; index += 1) {
    const offset = index * 3;
    const x = originalPositions[offset];
    const y = originalPositions[offset + 1];
    const z = originalPositions[offset + 2];
    let nearest = wheelCenters[0];
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const center of wheelCenters) {
      const dx = x - center.x;
      const dz = z - center.z;
      const candidateDistance = dx * dx + dz * dz;
      if (candidateDistance < nearestDistance) {
        nearest = center;
        nearestDistance = candidateDistance;
      }
    }
    const dy = y - centerY;
    const dz = z - nearest.z;
    const cosine = Math.cos(animation.angle);
    const sine = Math.sin(animation.angle);
    position.setXYZ(
      index,
      x,
      centerY + dy * cosine - dz * sine,
      nearest.z + dy * sine + dz * cosine,
    );
  }
  position.needsUpdate = true;
  animation.mesh.geometry.computeBoundingSphere();
}

function normalizeNasaModel(model: THREE.Object3D, maxSize: number, lift: number) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z);
  const scale = maxAxis > 0 ? maxSize / maxAxis : 1;
  model.position.sub(center);
  model.rotation.y = Math.PI;
  const wrapper = new THREE.Group();
  wrapper.add(model);
  wrapper.scale.setScalar(scale);
  wrapper.position.y = -(box.min.y - center.y) * scale + lift;
  wrapper.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return wrapper;
}

function createBaseDoor() {
  const doorGroup = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: "#111923", roughness: 0.8 });
  const blueGlow = new THREE.MeshStandardMaterial({
    color: "#8ee8ff",
    emissive: "#49d9ff",
    emissiveIntensity: 0.75,
    roughness: 0.28,
  });

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.86, 0.08), blueGlow);
  door.position.set(0.02, 0.54, 1.08);
  door.userData.action = "base-door";
  door.castShadow = true;
  doorGroup.add(door);

  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.08, 1.05, 0.05), dark);
  doorFrame.position.set(0.02, 0.56, 0.97);
  doorFrame.castShadow = true;
  doorFrame.renderOrder = -1;
  doorGroup.add(doorFrame);

  const ramp = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 1.1), dark);
  ramp.position.set(0.02, 0.13, 1.72);
  ramp.rotation.x = -0.16;
  ramp.receiveShadow = true;
  ramp.castShadow = true;
  doorGroup.add(ramp);

  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 18), new THREE.MeshBasicMaterial({ color: "#78f6ff" }));
  beacon.position.set(1.38, 1.42, 0.18);
  doorGroup.add(beacon);

  const light = new THREE.PointLight("#78f6ff", 2.1, 7);
  light.position.set(0.3, 1.12, 1.15);
  doorGroup.add(light);
  return doorGroup;
}

function createGreenhouse() {
  const greenhouse = new THREE.Group();
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.12, 1.1),
    new THREE.MeshStandardMaterial({ color: "#c9d4d8", roughness: 0.55 }),
  );
  frame.position.y = 0.12;
  greenhouse.add(frame);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: "#8ef5c8", transparent: true, opacity: 0.34, roughness: 0.1 }),
  );
  dome.scale.set(1.05, 0.7, 0.72);
  dome.position.y = 0.18;
  dome.castShadow = true;
  greenhouse.add(dome);

  const glow = new THREE.PointLight("#8ef5c8", 0.8, 4);
  glow.position.y = 0.85;
  greenhouse.add(glow);
  return greenhouse;
}

function createSoilMarker() {
  const group = new THREE.Group();
  const pickTarget = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 12, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  pickTarget.position.y = 0.12;
  group.add(pickTarget);

  const sample = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.24, 0),
    new THREE.MeshStandardMaterial({ color: "#c2b39b", roughness: 0.95 }),
  );
  sample.castShadow = true;
  group.add(sample);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.018, 8, 36),
    new THREE.MeshBasicMaterial({ color: "#f0a54a" }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.03;
  group.add(ring);

  const light = new THREE.PointLight("#f0a54a", 0.8, 3);
  light.position.y = 0.45;
  group.add(light);
  group.userData.groundOffset = 0.24;
  return group;
}

function getGroundOffset(object: THREE.Object3D) {
  return typeof object.userData.groundOffset === "number" ? object.userData.groundOffset : 0;
}

function createEarth(earthTexture: THREE.Texture) {
  const earth = new THREE.Group();
  const earthMaterial = new THREE.MeshStandardMaterial({
    map: earthTexture,
    roughness: 0.9,
    metalness: 0,
    emissive: "#2b6fa8",
    emissiveIntensity: 0.58,
  });
  earthMaterial.fog = false;
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 96, 64),
    earthMaterial,
  );
  earth.add(sphere);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 96, 64),
    new THREE.MeshBasicMaterial({
      color: "#74b7ff",
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
    }),
  );
  earth.add(glow);
  return earth;
}

function createStarField() {
  const geometry = new THREE.BufferGeometry();
  const count = 1800;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const radius = 21 + Math.random() * 23;
    const theta = Math.random() * Math.PI * 2;
    const y = -3 + Math.random() * 30;
    positions[i * 3] = Math.cos(theta) * radius;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(theta) * radius;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: "#dbeafe", size: 0.075, transparent: true, opacity: 0.82 }),
  );
}

function findActionObjects(root: THREE.Object3D, action: string) {
  const objects: THREE.Object3D[] = [];
  root.traverse((object) => {
    if (object.userData.action === action) {
      objects.push(object);
    }
  });
  return objects;
}

function findUserData<T>(object: THREE.Object3D, key: string): T | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const value = current.userData[key] as T | undefined;
    if (value !== undefined) return value;
    current = current.parent;
  }
  return null;
}

function updateRover(
  rover: THREE.Group,
  camera: THREE.PerspectiveCamera,
  dt: number,
  input: { forward: number; turn: number },
  cameraView: { yawOffset: number; height: number; lookHeight: number; distance: number },
  heightAt: (x: number, z: number) => number,
) {
  const turnRate = 1.9;
  const speed = 4.1;
  rover.rotation.y += input.turn * turnRate * dt;
  const forward = new THREE.Vector3(-Math.sin(rover.rotation.y), 0, -Math.cos(rover.rotation.y));
  rover.position.addScaledVector(forward, input.forward * speed * dt);
  animateRoverWheels(rover, input.forward * speed * dt);
  rover.position.x = THREE.MathUtils.clamp(rover.position.x, -16, 16);
  rover.position.z = THREE.MathUtils.clamp(rover.position.z, -16, 16);
  rover.position.y = heightAt(rover.position.x, rover.position.z) + ROVER_GROUND_OFFSET;

  positionCameraBehindRover(rover, camera, cameraView, false);
}

function positionCameraBehindRover(
  rover: THREE.Group,
  camera: THREE.PerspectiveCamera,
  cameraView: { yawOffset: number; height: number; lookHeight: number; distance: number },
  immediate: boolean,
) {
  const cameraTarget = rover.position.clone().add(new THREE.Vector3(0, cameraView.lookHeight, 0));
  const viewAngle = rover.rotation.y + cameraView.yawOffset;
  const orbit = new THREE.Vector3(
    Math.sin(viewAngle) * cameraView.distance,
    cameraView.height,
    Math.cos(viewAngle) * cameraView.distance,
  );
  const desired = rover.position.clone().add(orbit);
  if (immediate) {
    camera.position.copy(desired);
  } else {
    camera.position.lerp(desired, 0.08);
  }
  camera.lookAt(cameraTarget);
}

function terrainHeight(x: number, z: number) {
  let h = Math.sin(x * 0.48) * 0.08 + Math.cos(z * 0.42) * 0.07 + Math.sin((x + z) * 0.23) * 0.05;
  h += Math.sin(x * 1.7 + z * 0.4) * 0.018 + Math.cos(z * 1.45 - x * 0.25) * 0.018;
  for (const crater of lunarCraters) {
    const dx = x - crater.x;
    const dz = z - crater.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const r = crater.radius;
    if (d < r) {
      const t = d / r;
      h -= crater.depth * (1 - t * t);
    }
    if (d >= r && d < r * 1.22) {
      const rimT = (d - r) / (r * 0.22);
      h += crater.depth * 0.38 * Math.sin((1 - rimT) * Math.PI);
    }
  }
  return h;
}

function distance2D(a: THREE.Vector3, b: THREE.Vector3) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}
