import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";
import { query } from "@/data-access/db";
import { findBrightStar } from "@/lib/astronomy/bright-stars";
import { buildBrightStarCard, getRelatedBrightStars } from "@/lib/astronomy/bright-star-details";
import { getStellarProfile } from "@/lib/astronomy/stellar-profile";
import { getPlanetProfile } from "@/lib/astronomy/planet-profile";
import { buildConstellationCard, getConstellation, getConstellationMembers } from "@/lib/astronomy/constellations";

interface ObjectRow {
  id: number;
  slug: string;
  name_zh: string;
  name_en: string;
  object_type: string;
  magnitude: number | null;
  display_color: string | null;
}

interface CardRow {
  what_is_it: string;
  why_watch_it: string;
  what_next: string;
}

interface RelatedRow {
  slug: string;
  name_zh: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const localBrightStar = findBrightStar(slug);
  const localConstellation = getConstellation(slug);

  try {
    const objRows = await query<ObjectRow>(
      `SELECT id, slug, name_zh, name_en, object_type,
              magnitude::float8, display_color
       FROM celestial_objects
       WHERE slug = $1 AND is_active = true
       LIMIT 1`,
      [slug],
    );

    if (objRows.length === 0) {
      if (localConstellation) {
        const card = buildConstellationCard(localConstellation);
        return apiSuccess({
          object: {
            slug: localConstellation.slug,
            nameZh: localConstellation.nameZh,
            nameEn: localConstellation.nameEn,
            objectType: "constellation",
          },
          card,
          related: getConstellationMembers(localConstellation).map((star) => ({
            slug: star.slug,
            nameZh: star.nameZh,
          })),
        });
      }

      if (localBrightStar?.isActive) {
        const card = buildBrightStarCard(localBrightStar);
        return apiSuccess({
          object: {
            slug: localBrightStar.slug,
            nameZh: localBrightStar.nameZh,
            nameEn: localBrightStar.nameEn,
            objectType: "bright_star",
            stellarProfile: getStellarProfile(localBrightStar),
          },
          card: {
            whatIsIt: card.whatIsIt,
            whyWatchIt: card.whyWatchIt,
            whatNext: card.whatNext,
          },
          related: getRelatedBrightStars(localBrightStar),
        });
      }

      return apiError(ErrorCode.NOT_FOUND, "object not found");
    }

    const obj = objRows[0];
    const celestialProfile = obj.object_type === "bright_star" && localBrightStar?.isActive
      ? getStellarProfile(localBrightStar)
      : (obj.object_type === "planet" || obj.object_type === "star")
        ? getPlanetProfile(obj.slug, obj.magnitude)
        : null;

    let card: CardRow | null = null;
    try {
      const cardRows = await query<CardRow>(
        `SELECT what_is_it, why_watch_it, what_next
         FROM object_cards
         WHERE object_id = (SELECT id FROM celestial_objects WHERE slug = $1)
         LIMIT 1`,
        [slug],
      );
      if (cardRows.length > 0) card = cardRows[0];
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr?.code !== "42P01") throw err;
    }

    let related: Array<{ slug: string; nameZh: string }> = [];
    try {
      const relationRows = await query<RelatedRow>(
        `SELECT target.slug, target.name_zh
         FROM object_relations AS relation
         JOIN celestial_objects AS target ON target.id = relation.target_object_id
         WHERE relation.source_object_id = $1
           AND relation.relation_type = 'next_explore'
           AND target.is_active = true
         ORDER BY relation.sort_order ASC, relation.id ASC
         LIMIT 6`,
        [obj.id],
      );
      related = relationRows.map((item) => ({ slug: item.slug, nameZh: item.name_zh }));
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr?.code !== "42P01") throw err;
    }

    if (obj.object_type === "constellation") {
      const memberRows = await query<RelatedRow>(
        `SELECT member.slug, member.name_zh
         FROM constellations AS constellation
         JOIN constellation_members AS members
           ON members.constellation_id = constellation.id
         JOIN celestial_objects AS member
           ON member.id = members.object_id
         WHERE constellation.object_id = $1
         ORDER BY members.sort_order ASC`,
        [obj.id],
      );
      related = memberRows.map((member) => ({ slug: member.slug, nameZh: member.name_zh }));
    } else if (obj.object_type === "bright_star") {
      const relatedRows = await query<RelatedRow>(
        `SELECT DISTINCT related.slug, related.name_zh
         FROM constellation_members AS current_member
         JOIN constellation_members AS related_member
           ON related_member.constellation_id = current_member.constellation_id
          AND related_member.object_id <> current_member.object_id
         JOIN celestial_objects AS related
           ON related.id = related_member.object_id
         WHERE current_member.object_id = $1
         ORDER BY related.name_zh ASC
         LIMIT 3`,
        [obj.id],
      );
      if (related.length === 0 && relatedRows.length > 0) {
        related = relatedRows.map((item) => ({ slug: item.slug, nameZh: item.name_zh }));
      }
    }

    return apiSuccess({
      object: {
        slug: obj.slug,
        nameZh: obj.name_zh,
        nameEn: obj.name_en,
        objectType: obj.object_type,
        ...(celestialProfile ? { stellarProfile: celestialProfile } : {}),
      },
      card: obj.object_type === "bright_star" && localBrightStar?.isActive
        ? buildBrightStarCard(localBrightStar)
        : card
          ? {
              whatIsIt: card.what_is_it,
              whyWatchIt: card.why_watch_it,
              whatNext: card.what_next,
            }
          : null,
      related,
    });
  } catch {
    if (localBrightStar?.isActive) {
      const card = buildBrightStarCard(localBrightStar);
      return apiSuccess({
        object: {
          slug: localBrightStar.slug,
          nameZh: localBrightStar.nameZh,
          nameEn: localBrightStar.nameEn,
          objectType: "bright_star",
          stellarProfile: getStellarProfile(localBrightStar),
        },
        card: {
          whatIsIt: card.whatIsIt,
          whyWatchIt: card.whyWatchIt,
          whatNext: card.whatNext,
        },
        related: getRelatedBrightStars(localBrightStar),
      });
    }

    return apiError(ErrorCode.INTERNAL_ERROR, "object lookup failed");
  }
}
