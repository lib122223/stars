interface ExplorationCardProps {
  whyWatchIt: string;
  whatNext: string;
}

export default function ExplorationCard({
  whyWatchIt,
  whatNext,
}: ExplorationCardProps) {
  return (
    <div className="space-y-5 rounded-xl bg-surface/60 p-6 sm:p-8">
      <Section label="为什么值得看" text={whyWatchIt} />
      <Section label="下一步看什么" text={whatNext} />
    </div>
  );
}

function Section({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs text-white/25 mb-1.5">{label}</p>
      <p className="text-sm leading-relaxed text-white/55">{text}</p>
    </div>
  );
}
