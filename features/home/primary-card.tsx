import Link from "next/link";

interface PrimaryRecommendation {
  id: number;
  title: string;
  reason: string;
  recommendationType: string;
  targetRef: string;
  primaryAction: {
    label: string;
    type: string;
  };
  secondaryAction: {
    label: string;
    type: string;
    targetRef: string | null;
  };
}

export default function PrimaryCard({
  primaryRecommendation,
}: {
  primaryRecommendation: PrimaryRecommendation;
}) {
  const p = primaryRecommendation;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-surface p-8 sm:p-10">
      {/* 轻星空背景 */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(1.5px 1.5px at 15% 40%, #f0a54a, transparent), radial-gradient(1px 1px at 70% 25%, #f0a54a, transparent), radial-gradient(1.5px 1.5px at 45% 70%, #f0a54a, transparent), radial-gradient(1px 1px at 80% 60%, #f0a54a, transparent), radial-gradient(1px 1px at 25% 80%, #f0a54a, transparent), radial-gradient(1px 1px at 55% 35%, #f0a54a, transparent)",
        }}
      />
      <div
        className="absolute inset-0 animate-pulse opacity-[0.03]"
        style={{
          animationDuration: "4s",
          backgroundImage:
            "radial-gradient(2px 2px at 60% 30%, #f0a54a, transparent), radial-gradient(1.5px 1.5px at 20% 55%, #f0a54a, transparent), radial-gradient(1px 1px at 75% 75%, #f0a54a, transparent)",
        }}
      />

      <div className="relative z-10">
        <p className="text-accent/50 text-xs tracking-wider uppercase">
          今晚先看
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {p.title}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-white/45">
          {p.reason}
        </p>

        <div className="mt-6 flex items-center gap-3">
          <Link
            href={`/sky-map?target=${p.targetRef}&source=primary`}
            className="inline-flex items-center rounded-lg bg-accent/20 px-5 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/30"
          >
            {p.primaryAction.label}
          </Link>
          {p.secondaryAction.targetRef ? (
            <Link
              href={`/objects/${p.secondaryAction.targetRef}`}
              className="inline-flex items-center rounded-lg px-4 py-2.5 text-sm text-white/30 transition-colors hover:text-white/50"
            >
              {p.secondaryAction.label}
            </Link>
          ) : (
            <span className="inline-flex items-center rounded-lg px-4 py-2.5 text-sm text-white/15">
              {p.secondaryAction.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
