export default function StarMapPlaceholder() {
  return (
    <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-background">
      {/* 模拟夜空微光 */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 20% 30%, #fff, transparent), radial-gradient(1px 1px at 50% 60%, #fff, transparent), radial-gradient(1.5px 1.5px at 70% 20%, #fff, transparent), radial-gradient(1px 1px at 30% 75%, #fff, transparent), radial-gradient(1px 1px at 60% 40%, #fff, transparent), radial-gradient(1px 1px at 80% 55%, #fff, transparent), radial-gradient(1.5px 1.5px at 45% 15%, #fff, transparent), radial-gradient(1px 1px at 25% 50%, #fff, transparent), radial-gradient(1px 1px at 65% 70%, #fff, transparent), radial-gradient(1px 1px at 55% 85%, #fff, transparent), radial-gradient(1.5px 1.5px at 10% 65%, #fff, transparent), radial-gradient(1px 1px at 85% 35%, #fff, transparent), radial-gradient(1px 1px at 40% 10%, #fff, transparent), radial-gradient(1px 1px at 75% 45%, #fff, transparent), radial-gradient(1px 1px at 15% 80%, #fff, transparent), radial-gradient(1px 1px at 90% 70%, #fff, transparent)",
        }}
      />

      {/* 中心提示 */}
      <div className="relative z-10 text-center px-4">
        <p className="text-white/20 text-sm tracking-wide">
          星图区域 · 待接入候选方案
        </p>
        <p className="mt-1 text-white/10 text-xs">
          候选方案接入后将在此渲染星图本体
        </p>
      </div>

      {/* 简易方位指示 */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-3 text-white/15 text-xs">
        <span>N</span>
        <span className="text-white/8">|</span>
        <span>E</span>
        <span className="text-white/8">|</span>
        <span>S</span>
        <span className="text-white/8">|</span>
        <span>W</span>
      </div>
    </div>
  );
}
