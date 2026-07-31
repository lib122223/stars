import type { Metadata } from "next";
import GalleryPageClient from "@/features/gallery/gallery-page-client";

export const metadata: Metadata = {
  title: "真实星空画廊 | Echo of Photons",
  description: "地球实拍天空、深空、行星、流星雨和用户观测照片",
};

export default function GalleryPage() {
  return (
    <div className="mx-auto min-h-[calc(100vh-3rem)] max-w-5xl px-4 py-10">
      <header className="mb-6 max-w-2xl">
        <p className="text-xs text-white/20">Gallery</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white/85">
          天空观测画廊
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/42">
          这里展示地球实拍天空、专业机构深空影像、行星月面，以及用户自己的观测照片。
        </p>
      </header>

      <GalleryPageClient />
    </div>
  );
}
