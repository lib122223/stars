const typeLabel: Record<string, string> = {
  constellation: "星座",
  bright_star: "亮星",
  planet: "行星",
};

interface ObjectSummaryProps {
  nameZh: string;
  nameEn: string;
  objectType: string;
}

export default function ObjectSummary({
  nameZh,
  nameEn,
  objectType,
}: ObjectSummaryProps) {
  return (
    <div className="text-center">
      <p className="text-accent/40 text-xs tracking-wider uppercase">
        {typeLabel[objectType] ?? objectType}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {nameZh}
      </h1>
      <p className="mt-1 text-sm text-white/30">{nameEn}</p>
    </div>
  );
}
