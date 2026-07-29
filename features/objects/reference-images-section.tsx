import type { ReferenceImage } from "@/lib/astronomy/reference-images";

interface ReferenceImagesSectionProps {
  images: ReferenceImage[];
}

export default function ReferenceImagesSection({ images }: ReferenceImagesSectionProps) {
  if (images.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <p className="text-xs text-white/20">本体影像</p>
        <p className="mt-1 text-xs leading-relaxed text-white/35">
          只在照片能明确表达该天体本体时展示；普通恒星不再用星野照片替代。
        </p>
      </div>
      <div className="grid gap-3">
        {images.map((image) => (
          <ReferenceImageCard key={image.id} image={image} />
        ))}
      </div>
    </section>
  );
}

function ReferenceImageCard({ image }: { image: ReferenceImage }) {
  return (
    <article className="overflow-hidden rounded-xl bg-surface/50">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#05090d]">
        <img
          src={image.src}
          alt={image.alt}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
      </div>
      <div className="space-y-3 p-4">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-white/80">{image.title}</h2>
            <span className="shrink-0 rounded bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/30">
              真实来源
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-white/45">{image.description}</p>
        </div>
        <dl className="grid grid-cols-1 gap-1.5 border-t border-white/[0.06] pt-3 text-[10px] leading-relaxed text-white/28">
          <Meta label="来源" value={image.meta.credit} />
          <Meta label="位置" value={image.meta.location} />
          <Meta label="时间" value={image.meta.capturedAt} />
          <Meta label="设备" value={image.meta.equipment} />
          <Meta label="授权" value={image.meta.license} />
          <div className="grid grid-cols-[2.5rem_1fr] gap-2">
            <dt className="text-white/18">链接</dt>
            <dd>
              <a
                href={image.meta.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-white/36 underline decoration-white/10 underline-offset-2 hover:text-white/60"
              >
                查看原始页面
              </a>
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr] gap-2">
      <dt className="text-white/18">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
