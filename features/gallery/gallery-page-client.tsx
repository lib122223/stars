"use client";

import { useEffect, useState } from "react";
import SkyGallerySection from "@/features/gallery/sky-gallery-section";
import { skyGalleryImages } from "@/lib/astronomy/sky-gallery";

export default function GalleryPageClient() {
  const [images, setImages] = useState(skyGalleryImages);
  const [selectedObjectSlug, setSelectedObjectSlug] = useState<string | null>(null);
  const [databaseState, setDatabaseState] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const objectSlug = new URLSearchParams(window.location.search).get("object");
      setSelectedObjectSlug(objectSlug || null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/gallery")
      .then((response) => response.json())
      .then((json: { code?: number; data?: { images?: typeof skyGalleryImages } }) => {
        if (cancelled) return;
        if (json.code === 0 && json.data?.images) {
          const remoteById = new Map(json.data.images.map((image) => [image.id, image]));
          const mergedImages = skyGalleryImages.map((localImage) => {
            const remoteImage = remoteById.get(localImage.id);
            return remoteImage
              ? { ...localImage, ...remoteImage, relatedObjectSlugs: localImage.relatedObjectSlugs }
              : localImage;
          });
          const remoteOnlyImages = json.data.images.filter((image) => !skyGalleryImages.some((localImage) => localImage.id === image.id));
          const uniqueImages = new Map(
            [...mergedImages, ...remoteOnlyImages].map((image) => [image.id, image]),
          );
          setImages([...uniqueImages.values()]);
          setDatabaseState("ready");
        } else {
          setDatabaseState("fallback");
        }
      })
      .catch(() => {
        if (!cancelled) setDatabaseState("fallback");
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      {databaseState === "loading" && (
        <p className="mb-3 text-xs text-white/25">正在读取画廊目录...</p>
      )}
      {databaseState === "fallback" && (
        <p className="mb-3 text-xs text-white/25">画廊目录服务暂不可用，当前显示本地缓存内容</p>
      )}
      <SkyGallerySection
        images={images}
        selectedObjectSlug={selectedObjectSlug}
        onClearSelectedObject={() => setSelectedObjectSlug(null)}
      />
    </>
  );
}
