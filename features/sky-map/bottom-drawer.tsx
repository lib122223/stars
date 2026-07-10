"use client";

import Link from "next/link";

interface GuideContent {
  target: string;
  reason: string;
}

interface ObjectContent {
  name: string;
  type: string;
  slug: string;
}

interface BottomDrawerProps {
  guide: GuideContent;
  selected: ObjectContent | null;
  onSimulateClick: () => void;
  source?: "primary" | "secondary" | "related" | "search";
}

const typeLabel: Record<string, string> = {
  constellation: "星座",
  bright_star: "亮星",
  planet: "行星",
  coord: "坐标",
};

export default function BottomDrawer({
  guide,
  selected,
  onSimulateClick,
  source = "primary",
}: BottomDrawerProps) {
  return (
    <div className="border-t border-white/5 bg-surface/90 backdrop-blur-sm">
      {selected ? (
        /* 点击后：对象摘要 + 详情入口（coord 除外） */
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 transition-opacity duration-200">
          <div className="flex items-center gap-3">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                selected.type === "coord" ? "bg-white/20" : "bg-accent"
              }`}
            />
            <div>
              <p className="text-sm font-medium text-white/90">
                {selected.name}
              </p>
              <p className="text-xs text-white/40">
                {typeLabel[selected.type] ?? selected.type}
              </p>
            </div>
          </div>
          {selected.type !== "coord" ? (
            <Link
              href={`/objects/${selected.slug}`}
              className="rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/25"
            >
              查看详情
            </Link>
          ) : (
            <span className="text-xs text-white/15">识别未匹配</span>
          )}
        </div>
      ) : (
        /* 点击前：引导去找什么 */
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm text-white/70">
              {source === "primary" ? "今晚先找" : source === "secondary" ? "也可以看看" : source === "related" ? "接下来可以找" : "正在找"}{" "}
              <span className="text-white/90">{guide.target}</span>
            </p>
            <p className="text-xs text-white/30 mt-0.5">{guide.reason}</p>
          </div>
          <button
            onClick={onSimulateClick}
            className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-white/40 transition-colors hover:bg-white/10"
          >
            模拟点击
          </button>
        </div>
      )}
    </div>
  );
}
