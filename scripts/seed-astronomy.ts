import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { brightStars } from "@/lib/astronomy/bright-stars";
import { buildBrightStarCard } from "@/lib/astronomy/bright-star-details";
import { activeConstellations, buildConstellationCard } from "@/lib/astronomy/constellations";
import { cosmicCatalog } from "@/lib/astronomy/cosmic-map";
import { skyGalleryImages } from "@/lib/astronomy/sky-gallery";
import { getReferenceImages } from "@/lib/astronomy/reference-images";
import { meteorShowers } from "@/lib/astronomy/meteor-showers";
import { extendedObjectCards, objectRelationSeeds } from "@/data-access/extended-object-content";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const baseObjects = [
    ["sun", "太阳", "Sun", "star"],
    ["earth", "地球", "Earth", "planet"],
    ["mercury", "水星", "Mercury", "planet"],
  ["venus", "金星", "Venus", "planet"],
  ["mars", "火星", "Mars", "planet"],
  ["jupiter", "木星", "Jupiter", "planet"],
  ["saturn", "土星", "Saturn", "planet"],
  ["uranus", "天王星", "Uranus", "planet"],
  ["neptune", "海王星", "Neptune", "planet"],
  ["moon", "月球", "Moon", "planet"],
  ] as const;

  const seedSqlPath = fileURLToPath(new URL("../data-access/seed.sql", import.meta.url));
  const seedSql = await readFile(seedSqlPath, "utf8");
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();

  async function upsertObject(input: {
  slug: string;
  nameZh: string;
  nameEn: string;
  objectType: string;
  raHours?: number | null;
  decDeg?: number | null;
  magnitude?: number | null;
  visualSize?: number | null;
  displayColor?: string | null;
  searchAliases?: string[];
  isDetailReady?: boolean;
  }) {
  const result = await client.query<{ id: number }>(
    `INSERT INTO celestial_objects
       (slug, name_zh, name_en, object_type, ra_hours, dec_deg, magnitude,
        visual_size, display_color, search_aliases, is_detail_ready, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
     ON CONFLICT (slug) DO UPDATE SET
       name_zh = EXCLUDED.name_zh,
       name_en = EXCLUDED.name_en,
       object_type = EXCLUDED.object_type,
       ra_hours = COALESCE(EXCLUDED.ra_hours, celestial_objects.ra_hours),
       dec_deg = COALESCE(EXCLUDED.dec_deg, celestial_objects.dec_deg),
       magnitude = COALESCE(EXCLUDED.magnitude, celestial_objects.magnitude),
       visual_size = COALESCE(EXCLUDED.visual_size, celestial_objects.visual_size),
       display_color = COALESCE(EXCLUDED.display_color, celestial_objects.display_color),
       search_aliases = EXCLUDED.search_aliases,
       is_detail_ready = EXCLUDED.is_detail_ready,
       is_active = true,
       updated_at = NOW()
     RETURNING id`,
    [
      input.slug,
      input.nameZh,
      input.nameEn,
      input.objectType,
      input.raHours ?? null,
      input.decDeg ?? null,
      input.magnitude ?? null,
      input.visualSize ?? null,
      input.displayColor ?? null,
      input.searchAliases ?? [],
      input.isDetailReady ?? false,
    ],
  );
  return result.rows[0].id;
}

  async function upsertCard(objectId: number, card: {
  whatIsIt: string;
  whyWatchIt: string;
  whatNext: string;
  }) {
  await client.query(
    `INSERT INTO object_cards (object_id, what_is_it, why_watch_it, what_next)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (object_id) DO UPDATE SET
       what_is_it = EXCLUDED.what_is_it,
       why_watch_it = EXCLUDED.why_watch_it,
       what_next = EXCLUDED.what_next,
       updated_at = NOW()`,
    [objectId, card.whatIsIt, card.whyWatchIt, card.whatNext],
  );
}

  try {
  await client.query("BEGIN");
  await client.query(seedSql);

  for (const [slug, nameZh, nameEn, objectType] of baseObjects) {
    await upsertObject({ slug, nameZh, nameEn, objectType });
  }

  async function upsertRelation(sourceObjectId: number, targetObjectId: number, sortOrder: number) {
    await client.query(
      `INSERT INTO object_relations
         (source_object_id, target_object_id, relation_type, sort_order)
       VALUES ($1, $2, 'next_explore', $3)
       ON CONFLICT (source_object_id, target_object_id, relation_type) DO UPDATE SET
         sort_order = EXCLUDED.sort_order,
         updated_at = NOW()`,
      [sourceObjectId, targetObjectId, sortOrder],
    );
  }

  async function upsertMedia(input: {
    assetKey: string;
    mediaType: "gallery" | "object_reference" | "event_reference";
    galleryCategory?: string | null;
    objectId?: number | null;
    title: string;
    description: string;
    altText: string;
    externalUrl: string;
    sourceUrl: string;
    credit: string;
    location: string;
    capturedAt: string;
    equipment: string;
    license: string;
    sortOrder: number;
  }) {
    await client.query(
      `INSERT INTO media_assets
         (asset_key, media_type, gallery_category, object_id, title, description,
          alt_text, external_url, source_url, credit, location, captured_at,
          equipment, license, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true)
       ON CONFLICT (asset_key) DO UPDATE SET
         media_type = EXCLUDED.media_type,
         gallery_category = EXCLUDED.gallery_category,
         object_id = EXCLUDED.object_id,
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         alt_text = EXCLUDED.alt_text,
         external_url = EXCLUDED.external_url,
         source_url = EXCLUDED.source_url,
         credit = EXCLUDED.credit,
         location = EXCLUDED.location,
         captured_at = EXCLUDED.captured_at,
         equipment = EXCLUDED.equipment,
         license = EXCLUDED.license,
         sort_order = EXCLUDED.sort_order,
         is_active = true,
         updated_at = NOW()`,
      [
        input.assetKey,
        input.mediaType,
        input.galleryCategory ?? null,
        input.objectId ?? null,
        input.title,
        input.description,
        input.altText,
        input.externalUrl,
        input.sourceUrl,
        input.credit,
        input.location,
        input.capturedAt,
        input.equipment,
        input.license,
        input.sortOrder,
      ],
    );
  }

  function eventDate(peakDate: string, monthDay: string, edge: "start" | "end") {
    const peakYear = Number(peakDate.slice(0, 4));
    const candidate = `${peakYear}-${monthDay}`;
    if (edge === "start" && candidate > peakDate) return `${peakYear - 1}-${monthDay}`;
    if (edge === "end" && candidate < peakDate) return `${peakYear + 1}-${monthDay}`;
    return candidate;
  }

  function intensityLevel(zhr: number) {
    if (zhr >= 100) return "strong";
    if (zhr >= 50) return "medium";
    return "weak";
  }

  async function upsertEvent(shower: (typeof meteorShowers)[number]) {
    const eventResult = await client.query<{ id: number }>(
      `INSERT INTO astronomy_events
         (slug, event_type, name_zh, name_en, active_start_date, active_end_date,
          peak_date, zhr, intensity_level, summary, is_active)
       VALUES ($1, 'meteor_shower', $2, $3, $4, $5, $6, $7, $8, $9, true)
       ON CONFLICT (slug) DO UPDATE SET
         event_type = EXCLUDED.event_type,
         name_zh = EXCLUDED.name_zh,
         name_en = EXCLUDED.name_en,
         active_start_date = EXCLUDED.active_start_date,
         active_end_date = EXCLUDED.active_end_date,
         peak_date = EXCLUDED.peak_date,
         zhr = EXCLUDED.zhr,
         intensity_level = EXCLUDED.intensity_level,
         summary = EXCLUDED.summary,
         is_active = true,
         updated_at = NOW()
       RETURNING id`,
      [
        shower.slug,
        shower.nameZh,
        shower.nameEn,
        eventDate(shower.peakDate, shower.activeStart, "start"),
        eventDate(shower.peakDate, shower.activeEnd, "end"),
        shower.peakDate,
        shower.zhr,
        intensityLevel(shower.zhr),
        `${shower.nameZh}活跃期内均有机会观测，峰值夜的理论小时天顶流星数约为 ${shower.zhr}。`,
      ],
    );
    const eventId = eventResult.rows[0].id;
    await client.query(
      `INSERT INTO event_observation_notes
         (event_id, recommended_time_window, observation_tip, ideal_location_type, better_region_summary)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (event_id) DO UPDATE SET
         recommended_time_window = EXCLUDED.recommended_time_window,
         observation_tip = EXCLUDED.observation_tip,
         ideal_location_type = EXCLUDED.ideal_location_type,
         better_region_summary = EXCLUDED.better_region_summary,
         updated_at = NOW()`,
      [
        eventId,
        shower.recommendedTime,
        `优先选择峰值夜，避开强月光并让眼睛适应黑暗。${shower.locationHint}。`,
        shower.locationHint,
        `相比城市中心，${shower.locationHint}通常更有利于看到较暗的流星。`,
      ],
    );
    return eventId;
  }

  const objectIds = new Map<string, number>();
  for (const star of brightStars) {
    const id = await upsertObject({
      slug: star.slug,
      nameZh: star.nameZh,
      nameEn: star.nameEn,
      objectType: "bright_star",
      raHours: star.raHours,
      decDeg: star.decDeg,
      magnitude: star.magnitude,
      searchAliases: star.searchAliases,
      isDetailReady: true,
    });
    objectIds.set(star.slug, id);
    await upsertCard(id, buildBrightStarCard(star));
  }

  for (const object of cosmicCatalog) {
    await upsertObject({
      slug: object.slug,
      nameZh: object.nameZh,
      nameEn: object.nameEn,
      objectType: object.type,
      raHours: object.raHours,
      decDeg: object.decDeg,
      magnitude: object.magnitude,
      visualSize: object.visualSize,
      displayColor: object.color,
      searchAliases: object.aliases,
      isDetailReady: extendedObjectCards.some((card) => card.slug === object.slug),
    });
  }

  const contentObjectRows = await client.query<{ id: number; slug: string }>(
    `SELECT id, slug FROM celestial_objects WHERE is_active = true`,
  );
  const contentObjectIds = new Map(contentObjectRows.rows.map((object) => [object.slug, object.id]));

  for (const card of extendedObjectCards) {
    const objectId = contentObjectIds.get(card.slug);
    if (!objectId) throw new Error(`Missing object for extended card: ${card.slug}`);
    await upsertCard(objectId, card);
  }

  for (const relation of objectRelationSeeds) {
    const sourceObjectId = contentObjectIds.get(relation.sourceSlug);
    const targetObjectId = contentObjectIds.get(relation.targetSlug);
    if (!sourceObjectId || !targetObjectId) {
      throw new Error(`Missing object relation endpoint: ${relation.sourceSlug} -> ${relation.targetSlug}`);
    }
    await upsertRelation(sourceObjectId, targetObjectId, relation.sortOrder);
  }

    for (const constellation of activeConstellations()) {
    const objectId = await upsertObject({
      slug: constellation.slug,
      nameZh: constellation.nameZh,
      nameEn: constellation.nameEn,
      objectType: "constellation",
      searchAliases: [constellation.abbreviation],
      isDetailReady: true,
    });

    const constellationResult = await client.query<{ id: number }>(
      `INSERT INTO constellations (object_id, abbreviation, description, anchor_slug)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (object_id) DO UPDATE SET
         abbreviation = EXCLUDED.abbreviation,
         description = EXCLUDED.description,
         anchor_slug = EXCLUDED.anchor_slug,
         updated_at = NOW()
       RETURNING id`,
      [objectId, constellation.abbreviation, constellation.description, constellation.anchorSlug],
    );
    const constellationId = constellationResult.rows[0].id;
    await upsertCard(objectId, buildConstellationCard(constellation));

    await client.query("DELETE FROM constellation_members WHERE constellation_id = $1", [constellationId]);
    await client.query("DELETE FROM constellation_lines WHERE constellation_id = $1", [constellationId]);

    for (const [index, slug] of constellation.memberSlugs.entries()) {
      const memberId = objectIds.get(slug);
      if (!memberId) throw new Error(`Missing member star ${slug} for ${constellation.slug}`);
      await client.query(
        `INSERT INTO constellation_members (constellation_id, object_id, sort_order)
         VALUES ($1, $2, $3)`,
        [constellationId, memberId, index * 10 + 10],
      );
    }

    for (const [index, line] of constellation.lines.entries()) {
      const fromId = objectIds.get(line.from);
      const toId = objectIds.get(line.to);
      if (!fromId || !toId) {
        throw new Error(`Missing line endpoint in ${constellation.slug}: ${line.from} -> ${line.to}`);
      }
      await client.query(
        `INSERT INTO constellation_lines
           (constellation_id, from_object_id, to_object_id, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [constellationId, fromId, toId, index * 10 + 10],
      );
      }
    }

    for (const shower of meteorShowers) {
      await upsertEvent(shower);
    }

    for (const [index, image] of skyGalleryImages.entries()) {
      await upsertMedia({
        assetKey: `gallery:${image.id}`,
        mediaType: "gallery",
        galleryCategory: image.category,
        objectId: image.objectSlug ? contentObjectIds.get(image.objectSlug) ?? null : null,
        title: image.title,
        description: image.description,
        altText: image.alt,
        externalUrl: image.src,
        sourceUrl: image.image.sourceUrl,
        credit: image.image.credit,
        location: image.image.location,
        capturedAt: image.image.capturedAt,
        equipment: image.image.equipment,
        license: image.image.license,
        sortOrder: index * 10 + 10,
      });
    }

    for (const assetKey of [
      "gallery:ground-spring-sky-guide",
      "gallery:moon",
      "gallery:titan-hot-cross-bun",
    ]) {
      await client.query(
        `UPDATE media_assets
         SET is_active = false, updated_at = NOW()
         WHERE asset_key = $1 AND media_type = 'gallery'`,
        [assetKey],
      );
    }

    const referenceObjects = await client.query<{
      id: number;
      slug: string;
      name_zh: string;
      name_en: string;
      object_type: string;
    }>(
      `SELECT id, slug, name_zh, name_en, object_type
       FROM celestial_objects
       WHERE is_active = true`,
    );
    let referenceCount = 0;
    for (const object of referenceObjects.rows) {
      const images = getReferenceImages({
        slug: object.slug,
        nameZh: object.name_zh,
        nameEn: object.name_en,
        objectType: object.object_type,
      });
      for (const [index, image] of images.entries()) {
        await upsertMedia({
          assetKey: `reference:${object.slug}:${image.id}`,
          mediaType: "object_reference",
          objectId: object.id,
          title: image.title,
          description: image.description,
          altText: image.alt,
          externalUrl: image.src,
          sourceUrl: image.meta.sourceUrl,
          credit: image.meta.credit,
          location: image.meta.location,
          capturedAt: image.meta.capturedAt,
          equipment: image.meta.equipment,
          license: image.meta.license,
          sortOrder: index * 10 + 10,
        });
        referenceCount += 1;
      }
    }

  await client.query("COMMIT");
  console.log(`Astronomy seed complete: ${brightStars.length} bright stars, ${cosmicCatalog.length} deep-sky objects, ${activeConstellations().length} constellations, ${extendedObjectCards.length} extended object cards, ${objectRelationSeeds.length} object relations, ${meteorShowers.length} astronomy events, ${skyGalleryImages.length} gallery images, ${referenceCount} object reference images.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
