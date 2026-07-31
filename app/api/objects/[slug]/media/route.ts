import { query } from "@/data-access/db";
import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";

interface MediaRow {
  asset_key: string;
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
}

function mapReferenceImage(row: MediaRow) {
  return {
    id: row.asset_key,
    kind: "object_photo",
    title: row.title,
    description: row.description,
    src: `/api/media/${encodeURIComponent(row.asset_key)}`,
    alt: row.alt_text,
    meta: {
      credit: row.credit,
      location: row.location,
      capturedAt: row.captured_at,
      equipment: row.equipment,
      license: row.license,
      sourceUrl: row.source_url,
    },
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const rows = await query<MediaRow>(
      `SELECT media.asset_key, media.title, media.description, media.alt_text,
              media.external_url,
              media.source_url, media.credit, media.location, media.captured_at,
              media.equipment, media.license
       FROM media_assets AS media
       JOIN celestial_objects AS object ON object.id = media.object_id
       WHERE object.slug = $1
         AND object.is_active = true
         AND media.media_type = 'object_reference'
         AND media.is_active = true
       ORDER BY media.sort_order ASC, media.id ASC`,
      [slug],
    );
    return apiSuccess({ images: rows.map(mapReferenceImage) });
  } catch {
    return apiError(ErrorCode.INTERNAL_ERROR, "object media lookup failed");
  }
}
