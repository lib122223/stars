import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";
import { query } from "@/data-access/db";
import { activeBrightStars } from "@/lib/astronomy/bright-stars";
import { findConstellationByName } from "@/lib/astronomy/constellations";

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

  const q = name.trim().toLowerCase();
  const localBrightStar = nameType && nameType !== "bright_star"
    ? null
    : activeBrightStars().find((s) =>
        s.nameZh.toLowerCase() === q ||
        s.nameEn.toLowerCase() === q ||
        s.slug.toLowerCase() === q ||
        s.searchAliases?.some((a) => a.toLowerCase() === q),
      );
  const localConstellation = nameType && nameType !== "constellation"
    ? null
    : findConstellationByName(name);

  if (localConstellation) {
    return apiSuccess({
      matched: true,
      object: {
        slug: localConstellation.slug,
        nameZh: localConstellation.nameZh,
        nameEn: localConstellation.nameEn,
        objectType: "constellation",
      },
      detailUrl: `/objects/${localConstellation.slug}`,
    });
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
      if (localBrightStar) {
        return apiSuccess({
          matched: true,
          object: {
            slug: localBrightStar.slug,
            nameZh: localBrightStar.nameZh,
            nameEn: localBrightStar.nameEn,
            objectType: "bright_star",
          },
          detailUrl: `/objects/${localBrightStar.slug}`,
        });
      }

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
    if (localBrightStar) {
      return apiSuccess({
        matched: true,
        object: {
          slug: localBrightStar.slug,
          nameZh: localBrightStar.nameZh,
          nameEn: localBrightStar.nameEn,
          objectType: "bright_star",
        },
        detailUrl: `/objects/${localBrightStar.slug}`,
      });
    }

    return apiError(ErrorCode.INTERNAL_ERROR, "resolve lookup failed");
  }
}
