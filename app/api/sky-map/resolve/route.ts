import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";
import { query } from "@/data-access/db";

interface CelestialRow {
  slug: string;
  name_zh: string;
  name_en: string;
  object_type: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const nameType = searchParams.get("type");

  if (!name) {
    return apiError(ErrorCode.INVALID_PARAMS, "name is required");
  }

  try {
    // 第一阶段匹配策略：name 匹配 name_zh 或 name_en
    const rows = await query<CelestialRow>(
      `SELECT slug, name_zh, name_en, object_type
       FROM celestial_objects
       WHERE is_active = true
         AND (LOWER(name_zh) = LOWER($1) OR LOWER(name_en) = LOWER($1))
       LIMIT 1`,
      [name],
    );

    if (rows.length === 0) {
      return apiSuccess({
        matched: false,
        object: null,
        detailUrl: null,
      });
    }

    const obj = rows[0];

    return apiSuccess({
      matched: true,
      object: {
        slug: obj.slug,
        nameZh: obj.name_zh,
        nameEn: obj.name_en,
        objectType: obj.object_type,
      },
      detailUrl: `/objects/${obj.slug}`,
    });
  } catch {
    return apiError(ErrorCode.INTERNAL_ERROR, "resolve lookup failed");
  }
}
