import { activeBrightStars } from "@/lib/astronomy/bright-stars";
import { activeConstellations } from "@/lib/astronomy/constellations";
import { cosmicCatalog } from "@/lib/astronomy/cosmic-map";
import type { AstronomyCatalog } from "@/lib/astronomy/catalog-types";

export function getLocalAstronomyCatalog(): AstronomyCatalog {
  return {
    brightStars: activeBrightStars(),
    constellations: activeConstellations(),
    cosmicObjects: cosmicCatalog.map((object) => ({
      ...object,
      isDetailReady: true,
    })),
  };
}
