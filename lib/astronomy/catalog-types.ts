import type { BrightStar } from "@/lib/astronomy/bright-stars";
import type { Constellation } from "@/lib/astronomy/constellations";
import type { CosmicCatalogObject } from "@/lib/astronomy/cosmic-map";

export interface AstronomyCatalog {
  brightStars: BrightStar[];
  constellations: Constellation[];
  cosmicObjects: CosmicCatalogObject[];
}
