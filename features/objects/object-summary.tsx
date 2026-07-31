import type { StellarProfile } from "@/lib/astronomy/stellar-profile";
import StellarProfilePanel from "@/features/objects/stellar-profile-panel";

const typeLabel: Record<string, string> = {
  constellation: "星座",
  bright_star: "恒星",
  star: "恒星",
  planet: "行星",
};

interface ObjectSummaryProps {
  nameZh: string;
  nameEn: string;
  objectType: string;
  stellarProfile?: StellarProfile | null;
}

export default function ObjectSummary({
  nameZh,
  nameEn,
  objectType,
  stellarProfile,
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
      {stellarProfile ? (
        <StellarProfilePanel profile={stellarProfile} />
      ) : null}
    </div>
  );
}
