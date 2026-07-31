"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SimulatorView = "camera" | "optical";
type ProScenario = "bright" | "dim" | "lightPollution";

type CameraSettings = {
  lens: string;
  whiteBalance: string;
  focus: string;
  shutter: string;
  iso: string;
  exposure: string;
};

const settingOptions = {
  lens: ["1x 主摄（推荐）", "0.5x 超广角", "2x 长焦", "3x 长焦"],
  whiteBalance: ["自动", "3200 K", "3800 K", "4500 K", "5500 K"],
  focus: ["自动", "远景/自动", "无限远"],
  shutter: ["自动", "1/2 秒", "1 秒", "2 秒", "4 秒", "8 秒", "10 秒"],
  iso: ["自动", "400", "800", "1600", "3200"],
  exposure: ["-1.0", "-0.3", "0.0", "+0.3", "+1.0"],
} as const;

const proScenarios: Record<ProScenario, {
  label: string;
  detail: string;
  settings: CameraSettings;
  tip: string;
}> = {
  bright: {
    label: "拍亮星识别",
    detail: "织女星、天狼星、木星等明亮目标",
    settings: { lens: "1x 主摄（推荐）", whiteBalance: "3800 K", focus: "无限远", shutter: "2 秒", iso: "800", exposure: "0.0" },
    tip: "推荐从这一组开始。适合网页识别，亮度和清晰度比较平衡。",
  },
  dim: {
    label: "拍较暗星空",
    detail: "星座中较暗的成员星",
    settings: { lens: "1x 主摄（推荐）", whiteBalance: "3800 K", focus: "无限远", shutter: "4 秒", iso: "1600", exposure: "0.0" },
    tip: "必须把手机固定好；如果画面拖影，退回“拍亮星识别”。",
  },
  lightPollution: {
    label: "附近有路灯",
    detail: "光污染明显、天空偏亮",
    settings: { lens: "1x 主摄（推荐）", whiteBalance: "3200 K", focus: "无限远", shutter: "1 秒", iso: "400", exposure: "-0.3" },
    tip: "先避开路灯和反光，再使用这组参数；不要用更长快门硬压过曝。",
  },
};

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
  const [view, setView] = useState<SimulatorView>("camera");
  const [returnTo, setReturnTo] = useState("/sky-map?mode=observe");
  const [deviceId, setDeviceId] = useState(devices[1].id);
  const [targetId, setTargetId] = useState(targets[0].id);
  const [eyepiece, setEyepiece] = useState(devices[1].eyepiece);
  const device = devices.find((item) => item.id === deviceId) ?? devices[0];
  const target = targets.find((item) => item.id === targetId) ?? targets[0];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "optical") setView("optical");
    const requestedReturn = params.get("returnTo");
    if (requestedReturn?.startsWith("/") && !requestedReturn.startsWith("//")) setReturnTo(requestedReturn);
  }, []);

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
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white/90">相机设置与观测设备</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/42">先在这里准备手机相机，再拍摄和上传星空照片进行识别。</p>
        </div>
        <Link href={returnTo} className="text-xs text-accent/70 hover:text-accent">返回拍摄识别</Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-white/[0.08] pb-3">
        <button type="button" onClick={() => setView("camera")} className={`rounded-md px-3 py-2 text-xs transition-colors ${view === "camera" ? "bg-accent/[0.14] text-accent" : "text-white/45 hover:bg-white/[0.05] hover:text-white/70"}`}>手机相机设置</button>
        <button type="button" onClick={() => setView("optical")} className={`rounded-md px-3 py-2 text-xs transition-colors ${view === "optical" ? "bg-accent/[0.14] text-accent" : "text-white/45 hover:bg-white/[0.05] hover:text-white/70"}`}>光学设备视野</button>
      </div>

      {view === "camera" && <CameraSettingsPanel returnTo={returnTo} />}

      {view === "optical" && <div className="mt-6 grid gap-5 lg:grid-cols-[19rem_1fr]">
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
      </div>}
    </div>
  );
}

function CameraSettingsPanel({ returnTo }: { returnTo: string }) {
  const [proScenario, setProScenario] = useState<ProScenario>("bright");
  const [settings, setSettings] = useState<CameraSettings>(proScenarios.bright.settings);

  function applyProScenario(nextScenario: ProScenario) {
    setProScenario(nextScenario);
    setSettings(proScenarios[nextScenario].settings);
  }

  function updateSetting(key: keyof CameraSettings, value: string) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-[17rem_1fr]">
      <div className="rounded-xl border border-white/[0.08] bg-surface/55 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-accent/55">手机专业模式</p>
        <p className="mt-2 text-sm leading-relaxed text-white/65">只需要设置右侧这些参数。其余美颜、滤镜和普通拍照选项不参与星点识别。</p>
        <div className="mt-4 rounded-md border border-emerald-100/10 bg-emerald-100/[0.04] px-3 py-2 text-[10px] leading-relaxed text-emerald-50/60">
          不想手动判断时，选择右侧的“拍亮星识别”，直接照抄推荐值即可。
        </div>
        <div className="mt-4 rounded-md border border-amber-100/10 bg-amber-100/[0.04] px-3 py-2 text-[10px] leading-relaxed text-amber-50/60">
          网页不能直接修改手机原生相机参数。这里的设置是拍摄前的参考，完成设置后请打开手机相机拍照，再回到识别页面上传。
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-surface/45 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-accent/55">专业模式</p>
            <h2 className="mt-2 text-lg font-medium text-white/85">手机星空拍摄参数</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/45">手动控制镜头、白平衡、对焦、快门、ISO 和曝光补偿，优先保证亮星清晰。</p>
          </div>
          <Link href={returnTo} className="shrink-0 rounded-md border border-accent/25 bg-accent/[0.1] px-3 py-2 text-xs text-accent/85 hover:bg-accent/[0.16]">返回照片识别</Link>
        </div>

        <div className="mt-5 rounded-lg border border-amber-100/15 bg-amber-100/[0.045] p-3">
          <p className="text-xs font-medium text-amber-50/85">不知道怎么设置？先选择拍摄场景</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {(Object.keys(proScenarios) as ProScenario[]).map((item) => (
              <button key={item} type="button" onClick={() => applyProScenario(item)} className={`rounded-md border px-2.5 py-2 text-left transition-colors ${proScenario === item ? "border-amber-200/35 bg-amber-100/[0.1]" : "border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.06]"}`}>
                <span className={`block text-xs ${proScenario === item ? "text-amber-50/90" : "text-white/65"}`}>{proScenarios[item].label}</span>
                <span className="mt-1 block text-[10px] leading-relaxed text-white/35">{proScenarios[item].detail}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-amber-50/60">{proScenarios[proScenario].tip}</p>
          <p className="mt-2 rounded-md bg-black/20 px-2.5 py-2 text-[11px] font-medium text-amber-50/80">直接照抄：LENS {settings.lens} · WB {settings.whiteBalance} · F {settings.focus} · S {settings.shutter} · ISO {settings.iso} · EV {settings.exposure}</p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SettingSelect label="LENS 镜头" hint="优先使用 1x 主摄" value={settings.lens} options={settingOptions.lens} onChange={(value) => updateSetting("lens", value)} />
          <SettingSelect label="WB 白平衡" hint="先用推荐值即可" value={settings.whiteBalance} options={settingOptions.whiteBalance} onChange={(value) => updateSetting("whiteBalance", value)} />
          <SettingSelect label="F 对焦" hint="最重要：调到无限远" value={settings.focus} options={settingOptions.focus} onChange={(value) => updateSetting("focus", value)} />
          <SettingSelect label="S 快门" hint="越长越亮，也更容易拖影" value={settings.shutter} options={settingOptions.shutter} onChange={(value) => updateSetting("shutter", value)} />
          <SettingSelect label="ISO 感光度" hint="越高越亮，但噪点更多" value={settings.iso} options={settingOptions.iso} onChange={(value) => updateSetting("iso", value)} />
          <SettingSelect label="曝光补偿" hint="通常保持 0.0" value={settings.exposure} options={settingOptions.exposure} onChange={(value) => updateSetting("exposure", value)} />
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_18rem]">
          <div className="relative min-h-44 overflow-hidden rounded-lg border border-white/[0.08] bg-[#02050b]">
            <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_16%_26%,#fff_0_1px,transparent_1.5px),radial-gradient(circle_at_72%_34%,#d8eaff_0_1.5px,transparent_2px),radial-gradient(circle_at_44%_70%,#fff_0_1px,transparent_1.5px),radial-gradient(circle_at_83%_76%,#fff_0_1px,transparent_1.5px)] [background-size:97px_83px,131px_107px,73px_89px,151px_121px]" />
            <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_18px_6px_rgba(255,255,255,0.45)]" />
            <div className="absolute inset-x-3 top-3 flex justify-between text-[10px] text-white/55">
              <span>LENS {settings.lens}</span><span>F {settings.focus}</span>
            </div>
            <div className="absolute inset-x-3 bottom-3 flex justify-between text-[10px] text-white/55">
              <span>S {settings.shutter}</span><span>ISO {settings.iso}</span><span>EV {settings.exposure}</span>
            </div>
          </div>
          <div className="rounded-lg border border-cyan-100/10 bg-cyan-100/[0.035] px-3 py-3 text-xs leading-relaxed text-cyan-50/65">
            <p className="font-medium text-cyan-50/85">拍摄前检查</p>
            <ul className="mt-2 space-y-2 text-[11px] text-white/45">
              <li>镜头擦干净，关闭闪光灯。</li>
              <li>对焦到远处天空或无限远。</li>
              <li>手机靠在稳定位置，避免快门期间晃动。</li>
              <li>优先拍摄画面中孤立、明亮的目标。</li>
            </ul>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-amber-50/55">镜头建议：识别亮星时使用 1x 主摄最稳；0.5x 会让星点更小，2x/3x 长焦需要更稳定的支撑，只有目标足够亮时再使用。</p>
      </div>
    </section>
  );
}

function SettingSelect({ label, hint, value, options, onChange }: { label: string; hint: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <label className="block rounded-md border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
      <span className="block text-[10px] text-white/40">{label}</span>
      <span className="mt-0.5 block text-[10px] text-white/25">{hint}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full bg-transparent text-sm text-white/75 outline-none">
        {options.map((option) => <option key={option} value={option} className="bg-[#0b1118]">{option}</option>)}
      </select>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-white/[0.045] px-3 py-2.5"><p className="text-[10px] text-white/28">{label}</p><p className="mt-1 text-sm font-medium text-white/78">{value}</p></div>;
}
