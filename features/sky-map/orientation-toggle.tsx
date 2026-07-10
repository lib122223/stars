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
}

const statusMeta: Record<OrientationStatus, { label: string; active: boolean; hint?: string }> = {
  standard:    { label: "朝向", active: false },
  activating:  { label: "请求中…", active: true },
  active:      { label: "朝向中", active: true, hint: "已开启" },
  unavailable: { label: "朝向", active: false, hint: "不支持" },
};

export default function OrientationToggle({ status, onActivate, onDeactivate }: OrientationToggleProps) {
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
        title={isActive ? "关闭朝向模式" : "开启朝向模式"}
      >
        <svg
          width="11" height="11" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" className="shrink-0"
        >
          <circle cx="12" cy="12" r="10" />
          <polygon points="12,2 16,12 12,22 8,12" />
        </svg>
        <span className="hidden sm:inline">{meta.label}</span>
      </button>

      {meta.hint && (
        <span className="hidden sm:inline text-[10px] text-white/10">{meta.hint}</span>
      )}
    </div>
  );
}
