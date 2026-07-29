"use client";

import { useMemo, useState } from "react";

type Device = {
  id: string;
  name: string;
  category: string;
  aperture: number;
  focalLength: number;
  eyepiece: number;
  afov: number;
  sensorWidth: number;
  description: string;
};

type Target = {
  id: string;
  name: string;
  type: string;
  apparentSize: number;
  stars: Array<{ x: number; y: number; size: number; color: string }>;
};

const devices: Device[] = [
  { id: "eye", name: "肉眼", category: "基础观测", aperture: 7, focalLength: 17, eyepiece: 17, afov: 65, sensorWidth: 36, description: "适合判断星座轮廓、月相和明亮行星。" },
  { id: "binoculars", name: "10x50 双筒望远镜", category: "便携设备", aperture: 50, focalLength: 200, eyepiece: 20, afov: 65, sensorWidth: 36, description: "视野宽、上手快，适合月面和星团。" },
  { id: "refractor", name: "80mm 折射望远镜", category: "入门望远镜", aperture: 80, focalLength: 600, eyepiece: 25, afov: 52, sensorWidth: 36, description: "对月面、行星和双星有较好的成像稳定性。" },
  { id: "reflector", name: "150mm 牛顿反射镜", category: "深空观测", aperture: 150, focalLength: 750, eyepiece: 10, afov: 52, sensorWidth: 36, description: "更大的集光力，适合星云、星系和暗星团。" },
  { id: "catadioptric", name: "203mm 施卡望远镜", category: "行星观测", aperture: 203, focalLength: 2032, eyepiece: 25, afov: 50, sensorWidth: 36, description: "长焦与大口径结合，适合高倍率观察行星细节。" },
  { id: "camera", name: "80mm 天文摄影套装", category: "天文摄影", aperture: 80, focalLength: 400, eyepiece: 0, afov: 0, sensorWidth: 23.5, description: "以相机传感器视野模拟银河、星云和星系构图。" },
];

const targets: Target[] = [
  { id: "moon", name: "月球", type: "月面目标", apparentSize: 0.52, stars: [{ x: 50, y: 50, size: 38, color: "#d9e2ec" }] },
  {
    id: "orion",
    name: "猎户座",
    type: "星座",
    apparentSize: 5.5,
    stars: [
      { x: 45, y: 22, size: 5, color: "#cfe5ff" }, { x: 55, y: 27, size: 4, color: "#ffe0bd" },
      { x: 42, y: 45, size: 4, color: "#d8e8ff" }, { x: 50, y: 48, size: 6, color: "#ffd4b2" },
      { x: 58, y: 45, size: 4, color: "#d8e8ff" }, { x: 47, y: 70, size: 5, color: "#d8e8ff" },
      { x: 53, y: 69, size: 4, color: "#ffd9b7" },
    ],
  },
  {
    id: "pleiades",
    name: "昴星团",
    type: "疏散星团",
    apparentSize: 1.2,
    stars: [
      { x: 42, y: 40, size: 4, color: "#cfe5ff" }, { x: 54, y: 35, size: 5, color: "#d9edff" },
      { x: 63, y: 46, size: 4, color: "#bfe0ff" }, { x: 48, y: 55, size: 3, color: "#e5f3ff" },
      { x: 58, y: 62, size: 3, color: "#cfe5ff" }, { x: 35, y: 58, size: 3, color: "#e5f3ff" },
    ],
  },
  { id: "jupiter", name: "木星", type: "行星", apparentSize: 0.01, stars: [{ x: 50, y: 50, size: 8, color: "#e6c99f" }, { x: 40, y: 46, size: 2, color: "#d8e8ff" }, { x: 60, y: 54, size: 2, color: "#d8e8ff" }] },
];

function formatAngle(value: number) {
  return value >= 1 ? `${value.toFixed(1)}°` : `${(value * 60).toFixed(1)}′`;
}

export default function DeviceSimulator() {
  const [deviceId, setDeviceId] = useState(devices[1].id);
  const [targetId, setTargetId] = useState(targets[0].id);
  const [eyepiece, setEyepiece] = useState(devices[1].eyepiece);
  const device = devices.find((item) => item.id === deviceId) ?? devices[0];
  const target = targets.find((item) => item.id === targetId) ?? targets[0];

  const result = useMemo(() => {
    const magnification = device.eyepiece > 0 ? device.focalLength / eyepiece : 1;
    const fieldOfView = device.eyepiece > 0
      ? device.afov / magnification
      : (2 * Math.atan(device.sensorWidth / (2 * device.focalLength)) * 180) / Math.PI;
    const resolution = 116 / Math.max(device.aperture, 1);
    const limitingMagnitude = 2.7 + 5 * Math.log10(Math.max(device.aperture, 7));
    const targetScale = Math.min(6, Math.max(0.12, target.apparentSize / Math.max(fieldOfView, 0.01) * 42));
    return { magnification, fieldOfView, resolution, limitingMagnitude, targetScale };
  }, [device, eyepiece, target]);

  return (
    <div className="mx-auto min-h-[calc(100vh-3rem)] max-w-6xl px-4 py-8 sm:py-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-accent/55">设备模拟器</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white/90">不同设备下，你会看到什么</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/42">用真实的口径、焦距、目镜和传感器参数，比较同一个目标在不同设备中的视野差异。</p>
        </div>
        <span className="text-xs text-white/28">视野为光学参数估算</span>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[19rem_1fr]">
        <section className="rounded-xl border border-white/8 bg-surface/60 p-4">
          <label className="text-xs text-white/42" htmlFor="device-select">设备</label>
          <select id="device-select" value={deviceId} onChange={(event) => { setDeviceId(event.target.value); const next = devices.find((item) => item.id === event.target.value); if (next?.eyepiece) setEyepiece(next.eyepiece); }} className="mt-2 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white/75 outline-none">
            {devices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <p className="mt-3 text-xs text-accent/65">{device.category}</p>
          <p className="mt-2 text-sm leading-relaxed text-white/45">{device.description}</p>

          <label className="mt-5 block text-xs text-white/42" htmlFor="target-select">观测目标</label>
          <select id="target-select" value={targetId} onChange={(event) => setTargetId(event.target.value)} className="mt-2 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white/75 outline-none">
            {targets.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.type}</option>)}
          </select>

          {device.eyepiece > 0 ? (
            <label className="mt-5 block text-xs text-white/42" htmlFor="eyepiece-select">
              目镜焦距 <span className="text-white/22">{eyepiece} mm</span>
              <input id="eyepiece-select" type="range" min="5" max="40" step="1" value={eyepiece} onChange={(event) => setEyepiece(Number(event.target.value))} className="mt-3 w-full accent-[#f0a54a]" />
            </label>
          ) : (
            <div className="mt-5 rounded-md bg-white/[0.04] px-3 py-2 text-xs text-white/35">摄影设备使用传感器视场，不经过目镜放大。</div>
          )}
        </section>

        <section className="rounded-xl border border-white/8 bg-surface/45 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="放大倍率" value={`${result.magnification.toFixed(1)}x`} />
            <Stat label="视场宽度" value={formatAngle(result.fieldOfView)} />
            <Stat label="理论分辨率" value={`${result.resolution.toFixed(2)} arcsec`} />
            <Stat label="极限星等" value={`${result.limitingMagnitude.toFixed(1)} mag`} />
          </div>
          <div className="relative mt-5 aspect-[1.45] min-h-[18rem] overflow-hidden rounded-lg border border-white/10 bg-[#02050b]">
            <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_30%,#fff_0_1px,transparent_1.5px),radial-gradient(circle_at_70%_65%,#b9d9ff_0_1px,transparent_1.5px),radial-gradient(circle_at_48%_20%,#fff_0_1px,transparent_1.5px)] [background-size:83px_71px,107px_89px,131px_113px]" />
            <div className="absolute left-1/2 top-1/2 aspect-square w-[min(68%,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/35 bg-black/30 shadow-[0_0_60px_rgba(240,165,74,0.08)]">
              {target.stars.map((star, index) => <span key={`${target.id}-${index}`} className="absolute rounded-full shadow-[0_0_12px_currentColor]" style={{ left: `${star.x}%`, top: `${star.y}%`, width: `${Math.max(2, star.size * result.targetScale / 2)}px`, height: `${Math.max(2, star.size * result.targetScale / 2)}px`, backgroundColor: star.color, color: star.color, transform: "translate(-50%, -50%)" }} />)}
            </div>
            <div className="absolute bottom-3 left-3 text-xs text-white/35">{device.name} · {target.name}</div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-white/[0.045] px-3 py-2.5"><p className="text-[10px] text-white/28">{label}</p><p className="mt-1 text-sm font-medium text-white/78">{value}</p></div>;
}
