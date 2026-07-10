/**
 * 失败态卡片 — 保持主推荐卡外形，用平静语气承接失败
 */
interface ErrorCardProps {
  onRetry: () => void;
}

export default function ErrorCard({ onRetry }: ErrorCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-surface p-8 sm:p-10">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 40% 35%, #fff, transparent), radial-gradient(1px 1px at 65% 60%, #fff, transparent), radial-gradient(1px 1px at 25% 70%, #fff, transparent)",
        }}
      />

      <div className="relative z-10">
        <p className="text-white/20 text-xs tracking-wider uppercase">
          暂未获取到推荐
        </p>
        <p className="mt-2 text-lg font-medium text-white/50">
          不妨自己抬头看看今晚的夜空
        </p>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-white/25">
          推荐数据暂时无法加载，夜空本身仍然值得探索。
        </p>

        <button
          onClick={onRetry}
          className="mt-5 inline-flex items-center rounded-lg bg-white/[0.06] px-4 py-2 text-sm text-white/35 transition-colors hover:bg-white/[0.10] hover:text-white/55"
        >
          重新加载
        </button>
      </div>
    </div>
  );
}
