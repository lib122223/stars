import type { SkyGalleryImage } from "@/lib/astronomy/sky-gallery";

interface SkyGallerySectionProps {
  images: SkyGalleryImage[];
}

export default function SkyGallerySection({ images }: SkyGallerySectionProps) {
  if (images.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((image) => (
          <GalleryCard key={image.id} image={image} />
        ))}
      </div>
    </section>
  );
}

function GalleryCard({ image }: { image: SkyGalleryImage }) {
  return (
    <article className="overflow-hidden rounded-xl bg-surface/45">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#05090d]">
        <img
          src={image.src}
          alt={image.alt}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
        <span className="absolute left-3 top-3 rounded bg-black/35 px-2 py-0.5 text-[10px] text-white/65 backdrop-blur-sm">
          {image.category}
        </span>
      </div>
      <div className="space-y-3 p-3">
        <div>
          <h2 className="text-sm font-medium text-white/78">{image.title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/38">{image.description}</p>
        </div>
        <dl className="space-y-1 border-t border-white/[0.06] pt-3 text-[10px] leading-relaxed text-white/26">
          <Meta label="来源" value={image.image.credit} />
          <Meta label="位置" value={image.image.location} />
          <Meta label="授权" value={image.image.license} />
        </dl>
        <a
          href={image.image.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex text-[10px] text-white/38 underline decoration-white/10 underline-offset-2 hover:text-white/60"
        >
          查看原始来源
        </a>
      </div>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr] gap-2">
      <dt className="text-white/16">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
