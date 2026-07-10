interface ConditionSummaryData {
  basis: string;
  actionHint: string;
}

export default function ConditionSummary({
  conditionSummary,
}: {
  conditionSummary: ConditionSummaryData;
}) {
  const s = conditionSummary;

  return (
    <div className="flex items-center gap-3 text-xs text-white/25">
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-1 w-1 rounded-full bg-white/15" />
        {s.basis}
      </span>
      <span className="text-white/10">·</span>
      <span>{s.actionHint}</span>
    </div>
  );
}
