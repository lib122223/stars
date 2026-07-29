"use client";

export type OrientationStatus =
  | "standard"
  | "activating"
  | "active"
  | "unavailable";

interface OrientationToggleProps {
  status: OrientationStatus;
  onActivate: () => void;
  onDeactivate: () => void;
  activeLabel?: string;
  activeTitle?: string;
}

const statusMeta: Record<OrientationStatus, { label: string; active: boolean; hint?: string }> = {
  standard:    { label: "开始观察", active: false },
  activating:  { label: "请求中…", active: true },
  active:      { label: "2D", active: true },
  unavailable: { label: "手机观察", active: false, hint: "不支持" },
};

export default function OrientationToggle({
  status,
  onActivate,
  onDeactivate,
  activeLabel,
  activeTitle,
}: OrientationToggleProps) {
  const meta = statusMeta[status];
  const isActive = meta.active;

  function handleClick() {
    if (status === "activating") return;
    if (isActive) { onDeactivate(); } else { onActivate(); }
  }

  return (
    <div className="relative flex items-center gap-1">
      <button
        onClick={handleClick}
        disabled={status === "unavailable" || status === "activating"}
        className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] transition-colors ${
          isActive
            ? "border-accent/30 bg-accent/10 text-accent/80"
            : status === "unavailable"
            ? "border-white/5 bg-surface/30 text-white/10 cursor-not-allowed"
            : "border-white/10 bg-surface/50 text-white/20 hover:border-white/15 hover:text-white/35"
        }`}
        title={
          status === "unavailable"
            ? "需要手机方向传感器"
            : isActive
            ? activeTitle ?? "返回 2D 星图"
            : "进入观察模式"
        }
      >
        <svg
          width="11" height="11" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" className="shrink-0"
        >
          <circle cx="12" cy="12" r="10" />
          <polygon points="12,2 16,12 12,22 8,12" />
        </svg>
        <span className="hidden sm:inline">{isActive ? activeLabel ?? meta.label : meta.label}</span>
      </button>

      {meta.hint && (
        <span className="hidden sm:inline text-[10px] text-white/10">{meta.hint}</span>
      )}
    </div>
  );
}
