interface ObservationPanelProps {
  verdict: { suitable: boolean; summary: string };
  moon?: { phaseFraction: number; rise: string | null; set: string | null };
  sun?: { rise: string | null; set: string | null };
  cloud?: { cover: number } | null;
  clarity?: { level: string } | null;
  nearby?: { recommended: boolean; summary: string };
  events?: {
    slug: string;
    nameZh: string;
    peakDate: string;
    zhr: number;
    visibility: {
      band: "excellent" | "good" | "marginal" | "not_visible";
      score: number;
      activeNow: boolean;
      direction: string;
      radiantAltitude: number | null;
      summary: string;
    };
  }[];
}

function fmtMoonTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export default function ObservationPanel({
  verdict,
  moon,
  sun,
  cloud,
  clarity,
  nearby,
  events,
}: ObservationPanelProps) {
  return (
    <div className="space-y-5 rounded-xl bg-surface/60 p-6 sm:p-8">
      {/* 今晚观测总结论 */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              verdict.suitable ? "bg-accent" : "bg-white/25"
            }`}
          />
          <p className="text-sm font-medium text-white/80">
            {verdict.suitable ? "今晚适合观测" : "今晚观测条件一般"}
          </p>
        </div>
        <p className="text-sm leading-relaxed text-white/45 ml-[18px]">
          {verdict.summary}
        </p>
      </div>

      {/* 影响因素 */}
      {moon && (
        <div>
          <p className="text-xs text-white/25 mb-2">影响因素</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-white/40">云量</span>
              {cloud ? (
                <span className="text-white/40">{cloud.cover}%</span>
              ) : (
                <span className="text-white/15">待接入天气数据</span>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">月光</span>
              <span className="text-white/40">
                {Math.round(moon.phaseFraction * 100)}% 满月
                {" · "}出 {fmtMoonTime(moon.rise)} · 落 {fmtMoonTime(moon.set)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">天空清晰度</span>
              {clarity ? (
                <span className="text-white/40">{clarity.level}</span>
              ) : (
                <span className="text-white/15">待接入天气数据</span>
              )}
            </div>
            {sun && (
              <div className="flex justify-between">
                <span className="text-white/40">观测窗口</span>
                <span className="text-white/40">
                  日落 {fmtMoonTime(sun.set)} → 日出 {fmtMoonTime(sun.rise)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs text-white/25 mb-1.5">附近更优区域</p>
        {nearby ? (
          <p className={`text-sm ${nearby.recommended ? "text-white/55" : "text-white/25"}`}>
            {nearby.summary}
          </p>
        ) : (
          <p className="text-sm text-white/15">待接入区域数据</p>
        )}
      </div>

      {events && events.length > 0 && (
        <div>
          <div className="flex items-center mb-2">
          <p className="text-xs text-white/25">近期可关注天象</p>
          <a href="/events" className="ml-auto text-[11px] text-white/15 hover:text-white/30 transition-colors">
            查看全部 &rarr;
          </a>
        </div>
          <div className="space-y-1.5 text-xs text-white/40">
            {events.map((e) => (
              <div key={e.slug} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">{e.nameZh}</span>
                <span className={e.visibility.band === "not_visible" ? "shrink-0 text-white/25" : "shrink-0 text-accent/75"}>
                  {e.visibility.band === "not_visible" ? "本地不易" : `本地 ${e.visibility.score}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
