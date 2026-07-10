interface ObservationPanelProps {
  summary: string;
  sceneSuggestion: string;
  weatherHint: string;
}

export default function ObservationPanel({
  summary,
  sceneSuggestion,
  weatherHint,
}: ObservationPanelProps) {
  return (
    <div className="space-y-5 rounded-xl bg-surface/60 p-6 sm:p-8">
      <div>
        <p className="text-xs text-white/25 mb-1.5">观测摘要</p>
        <p className="text-sm leading-relaxed text-white/55">{summary}</p>
      </div>
      <div>
        <p className="text-xs text-white/25 mb-1.5">场景建议</p>
        <p className="text-sm leading-relaxed text-white/55">
          {sceneSuggestion}
        </p>
      </div>
      <div>
        <p className="text-xs text-white/25 mb-1.5">天气提示</p>
        <p className="text-sm leading-relaxed text-white/55">{weatherHint}</p>
      </div>
    </div>
  );
}
