import { query } from "@/data-access/db";
import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";

interface GalleryRow {
  asset_key: string;
  gallery_category: string | null;
  title: string;
  description: string;
  alt_text: string;
  external_url: string | null;
  source_url: string;
  credit: string;
  location: string;
  captured_at: string;
  equipment: string;
  license: string;
  object_slug: string | null;
}

function mapGalleryImage(row: GalleryRow) {
  return {
    id: row.asset_key.replace(/^gallery:/, ""),
    title: row.title,
    category: row.gallery_category ?? "其他",
    description: row.description,
    src: `/api/media/${encodeURIComponent(row.asset_key)}`,
    alt: row.alt_text,
    objectSlug: row.object_slug ?? undefined,
    image: {
      credit: row.credit,
      location: row.location,
      capturedAt: row.captured_at,
      equipment: row.equipment,
      license: row.license,
      sourceUrl: row.source_url,
    },
  };
}

export async function GET(request: Request) {
  const category = new URL(request.url).searchParams.get("category");
  try {
    const rows = await query<GalleryRow>(
      `SELECT asset_key, gallery_category, title, description, alt_text,
              external_url, source_url, credit,
              location, captured_at, equipment, license,
              objects.slug AS object_slug
       FROM media_assets
       LEFT JOIN celestial_objects AS objects ON objects.id = media_assets.object_id
       WHERE media_assets.media_type = 'gallery'
         AND media_assets.is_active = true
         AND ($1::text IS NULL OR media_assets.gallery_category = $1)
       ORDER BY media_assets.sort_order ASC, media_assets.id ASC`,
      [category || null],
    );
    return apiSuccess({ images: rows.map(mapGalleryImage) });
  } catch {
    return apiError(ErrorCode.INTERNAL_ERROR, "gallery media lookup failed");
  }
}
