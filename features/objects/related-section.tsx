import Link from "next/link";
import { withTimeContext, type TimeContextKey } from "@/lib/time-context";

interface RelatedObject {
  slug: string;
  nameZh: string;
}

interface RelatedSectionProps {
  objects: RelatedObject[];
  timeContext: TimeContextKey;
}

export default function RelatedSection({ objects, timeContext }: RelatedSectionProps) {
  if (objects.length === 0) return null;

  return (
    <div className="rounded-xl bg-surface/40 p-5">
      <p className="text-xs text-white/15 mb-2">下一步可以探索</p>
      <div className="flex flex-wrap gap-2">
        {objects.map((obj) => (
          <Link
            key={obj.slug}
            href={withTimeContext(
              `/sky-map?target=${obj.slug}&source=related`,
              timeContext,
            )}
            className="rounded bg-white/[0.06] px-3 py-1.5 text-xs text-white/35 transition-colors hover:bg-white/[0.12] hover:text-white/60"
          >
            {obj.nameZh}
          </Link>
        ))}
      </div>
    </div>
  );
}
