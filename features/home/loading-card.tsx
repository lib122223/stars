/**
 * 加载态骨架卡片 — 尺寸与主推荐卡对齐，保持第一屏结构稳定
 */
export default function LoadingCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-surface p-8 sm:p-10">
      {/* 微光呼吸 */}
      <div
        className="absolute inset-0 animate-pulse opacity-[0.02]"
        style={{ animationDuration: "3s" }}
      />

      <div className="relative z-10 space-y-4">
        {/* 标签骨架 */}
        <div className="h-3 w-14 rounded-sm bg-white/[0.06]" />

        {/* 标题骨架 */}
        <div className="h-8 w-48 rounded-sm bg-white/[0.08] sm:h-9" />

        {/* 理由骨架 */}
        <div className="space-y-2">
          <div className="h-4 w-full rounded-sm bg-white/[0.05]" />
          <div className="h-4 w-3/4 rounded-sm bg-white/[0.05]" />
        </div>

        {/* 按钮骨架 */}
        <div className="flex gap-3 pt-2">
          <div className="h-10 w-28 rounded-lg bg-white/[0.06]" />
          <div className="h-10 w-24 rounded-lg bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}
