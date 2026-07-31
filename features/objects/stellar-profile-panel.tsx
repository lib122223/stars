import type { ReactNode } from "react";
import type { StellarProfile } from "@/lib/astronomy/stellar-profile";

export default function StellarProfilePanel({ profile }: { profile: StellarProfile }) {
  return (
    <section className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.025] p-4 text-left sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">{profile.categoryLabel}特征</p>
          <p className="mt-1 text-sm text-white/70">亮度与颜色</p>
          <p className="mt-1 text-[10px] text-white/30">亮度：负星等 &gt; 一等 &gt; 二等 &gt; 三等</p>
        </div>
        <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] text-accent/75">
          {profile.brightnessLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric
          label={profile.magnitudeLabel}
          value={profile.magnitude == null ? "不适用" : `${profile.magnitude.toFixed(2)} 等`}
        />
        <Metric
          label="肉眼颜色"
          value={(
            <span className="inline-flex min-h-5 items-center gap-2 leading-5">
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-white/30 shadow-[0_0_10px_rgba(255,255,255,0.25)]"
              style={{ backgroundColor: profile.visualColorHex }}
            />
            {profile.visualColorLabel}
            </span>
          )}
        />
        <Metric
          className="col-span-2 sm:col-span-1"
          label="观测判断"
          value="按当前位置与天气而变"
        />
      </div>
      <p className="mt-2 text-[10px] text-white/30">视星等：数值越小，亮度越高</p>

    </section>
  );
}

function Metric({
  className = "",
  label,
  value,
}: {
  className?: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className={className}>
      <p className="text-[10px] text-white/25">{label}</p>
      <p className="mt-1 text-sm text-white/75">{value}</p>
    </div>
  );
}
