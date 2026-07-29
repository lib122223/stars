import type { Metadata } from "next";
import SkyGallerySection from "@/features/gallery/sky-gallery-section";
import { skyGalleryImages } from "@/lib/astronomy/sky-gallery";

export const metadata: Metadata = {
  title: "真实星空画廊 | Echo of Photons",
  description: "真实星空、银河、星云、星系和行星摄影图集",
};

export default function GalleryPage() {
  return (
    <div className="mx-auto min-h-[calc(100vh-3rem)] max-w-5xl px-4 py-10">
      <header className="mb-6 max-w-2xl">
        <p className="text-xs text-white/20">Gallery</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white/85">
          真实星空画廊
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/42">
          这里集中展示星野、银河、星云、星系和行星照片。详情页只放能明确代表天体本体的图片，普通恒星和星空氛围图统一放在这里。
        </p>
      </header>

      <SkyGallerySection images={skyGalleryImages} />
    </div>
  );
}
