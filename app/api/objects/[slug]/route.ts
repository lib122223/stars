import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";
import { query } from "@/data-access/db";

interface ObjectRow {
  slug: string;
  name_zh: string;
  name_en: string;
  object_type: string;
}

interface CardRow {
  what_is_it: string;
  why_watch_it: string;
  what_next: string;
}

/** 内容驱动的 related 关系 — 最小集合，仅引用内容对象池内的对象 */
const relatedBySlug: Record<string, Array<{ slug: string; nameZh: string }>> = {
  jupiter: [
    { slug: "venus", nameZh: "金星" },
    { slug: "saturn", nameZh: "土星" },
  ],
  venus: [
    { slug: "jupiter", nameZh: "木星" },
    { slug: "moon", nameZh: "月球" },
  ],
  mars: [
    { slug: "jupiter", nameZh: "木星" },
    { slug: "betelgeuse", nameZh: "参宿四" },
  ],
  saturn: [
    { slug: "jupiter", nameZh: "木星" },
    { slug: "moon", nameZh: "月球" },
  ],
  moon: [
    { slug: "venus", nameZh: "金星" },
    { slug: "jupiter", nameZh: "木星" },
  ],
  vega: [
    { slug: "polaris", nameZh: "北极星" },
    { slug: "sirius", nameZh: "天狼星" },
  ],
  sirius: [
    { slug: "orion", nameZh: "猎户座" },
    { slug: "betelgeuse", nameZh: "参宿四" },
  ],
  betelgeuse: [
    { slug: "orion", nameZh: "猎户座" },
    { slug: "sirius", nameZh: "天狼星" },
  ],
  polaris: [
    { slug: "vega", nameZh: "织女星" },
    { slug: "orion", nameZh: "猎户座" },
  ],
  orion: [
    { slug: "sirius", nameZh: "天狼星" },
    { slug: "betelgeuse", nameZh: "参宿四" },
  ],
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const objRows = await query<ObjectRow>(
      `SELECT slug, name_zh, name_en, object_type
       FROM celestial_objects
       WHERE slug = $1 AND is_active = true
       LIMIT 1`,
      [slug],
    );

    if (objRows.length === 0) {
      return apiError(ErrorCode.NOT_FOUND, "object not found");
    }

    const obj = objRows[0];

    // object_cards 表尚未创建，第一版 card 为空。
    // 仅静默表不存在错误（PG code 42P01），其他异常正常抛出。
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
      // 表不存在（42P01）：静默回退，card 保持 null
    }

    const related = relatedBySlug[slug] ?? [];

    return apiSuccess({
      object: {
        slug: obj.slug,
        nameZh: obj.name_zh,
        nameEn: obj.name_en,
        objectType: obj.object_type,
      },
      card: card
        ? {
            whatIsIt: card.what_is_it,
            whyWatchIt: card.why_watch_it,
            whatNext: card.what_next,
          }
        : null,
      related,
    });
  } catch {
    return apiError(ErrorCode.INTERNAL_ERROR, "object lookup failed");
  }
}
