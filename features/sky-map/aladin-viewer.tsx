"use client";

import { useEffect, useRef } from "react";

interface CelestialClick {
  name: string;
  type: string;
  slug: string;
}

interface AladinViewerProps {
  onObjectClick: (obj: CelestialClick) => void;
}

export default function AladinViewer({ onObjectClick }: AladinViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const aladinRef = useRef<{ remove?: () => void } | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    async function boot() {
      const A = (await import("aladin-lite")).default;

      if (cancelled || !containerRef.current) return;
      await A.init;
      if (cancelled || !containerRef.current) return;

      const aladin = A.aladin(containerRef.current, {
        survey: "P/DSS2/color",
        fov: 60,
        cooFrame: "equatorial",
        showFullscreenControl: false,
        showLayersControl: false,
        showGotoControl: false,
        showShareControl: false,
        showZoomControl: true,
        showStatusBar: false,
        showFrame: false,
        showFov: false,
        showProjectionControl: false,
        showSimbadPointerControl: false,
        showCooGrid: false,
      });

      aladinRef.current = { remove: () => aladin.remove() };

      aladin.on("objectClicked", (obj: unknown) => {
        const data = (obj as { data?: { NAME?: string; TYPE?: string } })
          ?.data;
        if (!data?.NAME) return;

        onObjectClick({
          name: data.NAME,
          type: data.TYPE || "unknown",
          slug: data.NAME.toLowerCase().replace(/\s+/g, "-"),
        });
      });
    }

    boot();

    return () => {
      cancelled = true;
      if (aladinRef.current) {
        aladinRef.current.remove?.();
        aladinRef.current = null;
      }
    };
  }, [onObjectClick]);

  return <div ref={containerRef} className="h-full w-full" />;
}
