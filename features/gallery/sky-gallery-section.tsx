import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { SkyGalleryImage } from "@/lib/astronomy/sky-gallery";

type GalleryFilter = "all" | "earth" | "events" | "deep" | "solar";

function groupFor(image: SkyGalleryImage): Exclude<GalleryFilter, "all"> {
  const text = `${image.title} ${image.description} ${image.image.location} ${image.image.equipment}`.toLowerCase();
  if (/(sunset|twilight|meteor|perseid|iss|satellite|aurora|晚霞|早霞|流星|卫星|极光|晨昏)/i.test(text)) return "events";
  if (/(jupiter|saturn|moon|planet|lunar|mercury|venus|mars|titan|行星|月面|火星|金星|水星|土卫六)/i.test(text)) return "solar";
  if (/(hubble|cassini|spacecraft|telescope observation|deep-sky|galaxy|nebula|星系|星云|星团)/i.test(text)) return "deep";
  return "earth";
}

function groupLabel(group: Exclude<GalleryFilter, "all">): string {
  if (group === "earth") return "地球实拍";
  if (group === "events") return "天象事件";
  if (group === "deep") return "深空与机构";
  return "行星与月面";
}

const objectLabels: Record<string, string> = {
  sirius: "天狼星",
  canopus: "老人星",
  arcturus: "大角星",
  vega: "织女星",
  capella: "五车二",
  rigel: "参宿七",
  procyon: "南河三",
  betelgeuse: "参宿四",
  altair: "牛郎星",
  aldebaran: "毕宿五",
  antares: "心宿二",
  spica: "角宿一",
  polaris: "北极星",
  regulus: "轩辕十四",
  deneb: "天津四",
  castor: "北河二",
  pollux: "北河三",
  dubhe: "天枢",
  merak: "天璇",
  phecda: "天玑",
  megrez: "天权",
  alioth: "玉衡",
  mizar: "开阳",
  alkaid: "摇光",
  alnitak: "参宿一",
  alnilam: "参宿二",
  mintaka: "参宿三",
  bellatrix: "参宿五",
  saiph: "参宿六",
  elnath: "五车五",
  shaula: "尾宿八",
  sargas: "尾宿五",
  dschubba: "房宿三",
  acrab: "房宿四",
  "kaus-australis": "箕宿三",
  nunki: "斗宿四",
  ascella: "斗宿一",
  "kaus-media": "箕宿二",
  "kaus-borealis": "斗宿二",
  alnasl: "箕宿一",
  sadr: "天津一",
  kochab: "帝",
  pherkad: "小熊座伽马",
  alphecca: "贯索四",
  izar: "牧夫座伊泽尔",
  muphrid: "牧夫座η",
  denebola: "五帝座一",
  algieba: "轩辕二",
  caph: "王良五",
  schedar: "王良四",
  alpheratz: "壁宿二",
  mirach: "奎宿九",
  almach: "天大将军一",
  pleiades: "昴星团",
  hyades: "毕星团",
};

export default function SkyGallerySection({
  images,
  selectedObjectSlug,
  onClearSelectedObject,
}: {
  images: SkyGalleryImage[];
  selectedObjectSlug?: string | null;
  onClearSelectedObject?: () => void;
}) {
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [openedImage, setOpenedImage] = useState<SkyGalleryImage | null>(null);
  const selectedImage = selectedObjectSlug
    ? images.find((image) => image.objectSlug === selectedObjectSlug || image.relatedObjectSlugs?.includes(selectedObjectSlug))
    : null;
  const filteredImages = useMemo(
    () => {
      if (selectedObjectSlug) return selectedImage ? [selectedImage] : [];
      return filter === "all" ? images : images.filter((image) => groupFor(image) === filter);
    },
    [filter, images, selectedImage, selectedObjectSlug],
  );

  useEffect(() => {
    if (!selectedObjectSlug || !selectedImage) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`gallery-${selectedImage.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [selectedImage, selectedObjectSlug]);

  useEffect(() => {
    if (!openedImage) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenedImage(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openedImage]);

  async function downloadImage(image: SkyGalleryImage) {
    try {
      const response = await fetch(image.src);
      if (!response.ok) throw new Error("image download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${image.id}.jpg`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(image.src, "_blank", "noopener,noreferrer");
    }
  }

  if (images.length === 0) return null;

  return (
    <section aria-labelledby="gallery-images-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">Archive</p>
          <h2 id="gallery-images-heading" className="mt-1 text-base font-medium text-white/78">天空照片</h2>
        </div>
        {selectedObjectSlug ? (
          <Link href="/gallery" onClick={onClearSelectedObject} className="text-xs text-white/45 underline decoration-white/15 underline-offset-4 hover:text-white/75">
            查看全部图片
          </Link>
        ) : (
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="画廊分类">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>全部 {images.length}</FilterButton>
            {(["earth", "events", "deep", "solar"] as const).map((group) => {
              const count = images.filter((image) => groupFor(image) === group).length;
              return <FilterButton key={group} active={filter === group} onClick={() => setFilter(group)}>{groupLabel(group)} {count}</FilterButton>;
            })}
          </div>
        )}
      </div>

      {selectedObjectSlug && selectedImage && (
        <p className="border-y border-accent/15 py-2 text-xs text-accent/75">
          已定位到：{selectedImage.title}
        </p>
      )}

      {selectedObjectSlug && !selectedImage && (
        <p className="border-y border-white/[0.08] py-8 text-center text-sm text-white/35">
          画廊暂时没有这个对象的图片。
        </p>
      )}

      {filteredImages.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredImages.map((image) => <GalleryCard key={image.id} image={image} highlighted={Boolean(selectedObjectSlug)} onOpen={() => setOpenedImage(image)} />)}
        </div>
      ) : !selectedObjectSlug ? (
        <p className="border-y border-white/[0.08] py-8 text-center text-sm text-white/30">这个分类暂时还没有图片。</p>
      ) : null}

      {openedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${openedImage.title} 图片预览`} onClick={() => setOpenedImage(null)}>
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/15 bg-[#07121b] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
              <p className="truncate text-sm text-white/80">{openedImage.title}</p>
              <button type="button" onClick={() => setOpenedImage(null)} className="shrink-0 rounded-md px-2 py-1 text-xs text-white/50 hover:bg-white/[0.08] hover:text-white/85">关闭</button>
            </div>
            <div className="min-h-0 overflow-auto bg-black/40 p-2 sm:p-4">
              <img src={openedImage.src} alt={openedImage.alt} className="mx-auto max-h-[76vh] max-w-full object-contain" decoding="async" />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/[0.08] px-4 py-3">
              <a href={openedImage.src} target="_blank" rel="noreferrer" className="text-xs text-white/45 hover:text-white/75">打开原图</a>
              <button type="button" onClick={() => void downloadImage(openedImage)} className="rounded-md border border-accent/25 bg-accent/[0.1] px-3 py-1.5 text-xs text-accent/85 hover:bg-accent/[0.16]">另存图片</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} role="tab" aria-selected={active} className={`rounded-md border px-2.5 py-1.5 text-[10px] transition-colors ${active ? "border-accent/25 bg-accent/[0.09] text-accent/85" : "border-white/[0.07] bg-white/[0.025] text-white/38 hover:text-white/65"}`}>
      {children}
    </button>
  );
}

function GalleryCard({ image, highlighted, onOpen }: { image: SkyGalleryImage; highlighted?: boolean; onOpen: () => void }) {
  const group = groupFor(image);
  const objectSlugs = [...new Set([image.objectSlug, ...(image.relatedObjectSlugs ?? [])].filter(Boolean))] as string[];
  return (
    <article id={`gallery-${image.id}`} className={`overflow-hidden rounded-xl bg-surface/45 ${highlighted ? "ring-1 ring-accent/45" : ""}`}>
      <div className="relative aspect-[4/3] overflow-hidden bg-[#05090d]">
        <button type="button" onClick={onOpen} aria-label={`放大查看 ${image.title}`} className="group block h-full w-full cursor-zoom-in">
          <img src={image.src} alt={image.alt} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        </button>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
        <span className="absolute left-3 top-3 rounded bg-black/35 px-2 py-0.5 text-[10px] text-white/65 backdrop-blur-sm">{groupLabel(group)}</span>
      </div>
      <div className="space-y-3 p-3">
        <div>
          <h2 className="text-sm font-medium text-white/78">{image.title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/38">{image.description}</p>
        </div>
        <dl className="space-y-1 border-t border-white/[0.06] pt-3 text-[10px] leading-relaxed text-white/26">
          <Meta label="来源" value={image.image.credit} />
          <Meta label="地点" value={image.image.location} />
          <Meta label="授权" value={image.image.license} />
        </dl>
        <a href={image.image.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex text-[10px] text-white/38 underline decoration-white/10 underline-offset-2 hover:text-white/60">查看原始来源</a>
        {objectSlugs.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {objectSlugs.map((slug) => (
              <Link key={slug} href={`/objects/${slug}`} className="inline-flex text-[10px] text-accent/65 underline decoration-accent/20 underline-offset-2 hover:text-accent">
                {objectLabels[slug] ?? slug}详情
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[2.5rem_1fr] gap-2"><dt className="text-white/16">{label}</dt><dd>{value}</dd></div>;
}
