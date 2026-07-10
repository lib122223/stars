type SceneType = "urban" | "suburban" | "open_space" | "balcony";

const sceneLabels: { value: SceneType; label: string }[] = [
  { value: "urban", label: "城市" },
  { value: "suburban", label: "郊区" },
  { value: "open_space", label: "开阔地" },
  { value: "balcony", label: "阳台" },
];

interface SettingsBarProps {
  sceneType: SceneType | null;
  onSceneTypeChange: (v: SceneType | null) => void;
}

export default function SettingsBar({
  sceneType,
  onSceneTypeChange,
}: SettingsBarProps) {
  return (
    <div className="flex items-center justify-center gap-1">
      <span className="text-[10px] text-white/15 mr-1">观测场景</span>
      {sceneLabels.map(({ value, label }) => (
        <button
          key={value}
          onClick={() =>
            onSceneTypeChange(sceneType === value ? null : value)
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
  );
}
