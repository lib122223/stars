import Link from "next/link";

interface SecondaryRecommendation {
  id: number;
  text: string;
  recommendationType: string;
  targetRef: string;
}

export default function SecondaryEntry({
  secondaryRecommendation,
}: {
  secondaryRecommendation: SecondaryRecommendation;
}) {
  const s = secondaryRecommendation;

  return (
    <Link
      href={`/sky-map?target=${s.targetRef}&source=secondary`}
      className="inline-flex items-center gap-1.5 text-xs text-white/20 transition-colors hover:text-white/35"
    >
      <span className="inline-block h-1 w-1 rounded-full bg-accent/40" />
      {s.text}
    </Link>
  );
}
