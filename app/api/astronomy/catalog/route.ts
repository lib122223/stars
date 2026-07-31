import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";
import { query } from "@/data-access/db";
import type { AstronomyCatalog } from "@/lib/astronomy/catalog-types";
import type { BrightStar } from "@/lib/astronomy/bright-stars";
import type { Constellation } from "@/lib/astronomy/constellations";
import type { CosmicCatalogObject } from "@/lib/astronomy/cosmic-map";

interface ObjectRow {
  id: number;
  slug: string;
  name_zh: string;
  name_en: string;
  object_type: string;
  ra_hours: number | null;
  dec_deg: number | null;
  magnitude: number | null;
  visual_size: number | null;
  display_color: string | null;
  search_aliases: string[];
  is_detail_ready: boolean;
}

interface ConstellationRow {
  id: number;
  object_id: number;
  abbreviation: string;
  description: string;
  anchor_slug: string;
}

interface MemberRow {
  constellation_id: number;
  slug: string;
  sort_order: number;
}

interface LineRow {
  constellation_id: number;
  from_slug: string;
  to_slug: string;
  sort_order: number;
}

function toBrightStar(row: ObjectRow): BrightStar {
  return {
    slug: row.slug,
    nameZh: row.name_zh,
    nameEn: row.name_en,
    raHours: row.ra_hours ?? 0,
    decDeg: row.dec_deg ?? 0,
    magnitude: row.magnitude ?? 9,
    isDetailReady: true,
    isActive: true,
    searchAliases: row.search_aliases ?? [],
  };
}

function toCosmicObject(row: ObjectRow): CosmicCatalogObject {
  return {
    slug: row.slug,
    nameZh: row.name_zh,
    nameEn: row.name_en,
    type: row.object_type as CosmicCatalogObject["type"],
    raHours: row.ra_hours ?? 0,
    decDeg: row.dec_deg ?? 0,
    magnitude: row.magnitude ?? 9,
    visualSize: row.visual_size ?? 1,
    color: row.display_color ?? "#b8c9e8",
    aliases: row.search_aliases ?? [],
    isDetailReady: row.is_detail_ready,
  };
}

export async function GET() {
  try {
    const objects = await query<ObjectRow>(
      `SELECT id, slug, name_zh, name_en, object_type,
              ra_hours::float8, dec_deg::float8, magnitude::float8,
              visual_size::float8, display_color, search_aliases
              , is_detail_ready
       FROM celestial_objects
       WHERE is_active = true
       ORDER BY id ASC`,
    );
    const constellationRows = await query<ConstellationRow>(
      `SELECT id, object_id, abbreviation, description, anchor_slug
       FROM constellations
       ORDER BY id ASC`,
    );
    const memberRows = await query<MemberRow>(
      `SELECT members.constellation_id, objects.slug, members.sort_order
       FROM constellation_members AS members
       JOIN celestial_objects AS objects ON objects.id = members.object_id
       ORDER BY members.constellation_id, members.sort_order`,
    );
    const lineRows = await query<LineRow>(
      `SELECT lines.constellation_id,
              from_object.slug AS from_slug,
              to_object.slug AS to_slug,
              lines.sort_order
       FROM constellation_lines AS lines
       JOIN celestial_objects AS from_object ON from_object.id = lines.from_object_id
       JOIN celestial_objects AS to_object ON to_object.id = lines.to_object_id
       ORDER BY lines.constellation_id, lines.sort_order`,
    );

    const objectById = new Map(objects.map((object) => [object.id, object]));
    const brightStars = objects
      .filter((object) => object.object_type === "bright_star" && object.ra_hours != null && object.dec_deg != null)
      .map(toBrightStar);
    const cosmicObjects = objects
      .filter((object) => ["galaxy", "nebula", "open_cluster", "globular_cluster"].includes(object.object_type))
      .map(toCosmicObject);
    const constellations: Constellation[] = constellationRows.flatMap((row) => {
      const object = objectById.get(row.object_id);
      if (!object) return [];
      const members = memberRows
        .filter((member) => member.constellation_id === row.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((member) => member.slug);
      const lines = lineRows
        .filter((line) => line.constellation_id === row.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((line) => ({ from: line.from_slug, to: line.to_slug }));
      return [{
        slug: object.slug,
        nameZh: object.name_zh,
        nameEn: object.name_en,
        abbreviation: row.abbreviation,
        description: row.description,
        memberSlugs: members,
        lines,
        anchorSlug: row.anchor_slug,
      }];
    });

    const catalog: AstronomyCatalog = { brightStars, constellations, cosmicObjects };
    return apiSuccess(catalog);
  } catch {
    return apiError(ErrorCode.INTERNAL_ERROR, "astronomy catalog unavailable");
  }
}
