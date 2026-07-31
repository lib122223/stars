import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import sharp from "sharp";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, "..");
const mediaRoot = path.join(projectRoot, "migration-media");
const bucket = process.env.SUPABASE_MEDIA_BUCKET ?? "astronomy-media";
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!supabaseUrl) throw new Error("SUPABASE_URL is required");
if (!serviceRoleKey && !dryRun) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");

const sourceByAssetKey = {
  "gallery:milky-way-sagittarius": "PIA18913",
  "gallery:anji-starry-sky": "PIA05546",
  "gallery:orion-real-sky": "sts054-97-018",
  "gallery:summer-triangle": "PIA14102",
  "gallery:big-dipper": "PIA15653",
  "gallery:orion-nebula": "PIA04227",
  "gallery:andromeda": "PIA04921",
  "gallery:pillars-of-creation": "GSFC_20171208_Archive_e000732",
  "gallery:ngc-1300": "GSFC_20171208_Archive_e002154",
  "gallery:jupiter": "PIA09231",
  "gallery:saturn": "PIA06423",
  "gallery:moon": "PIA12235",
  "gallery:moon-and-earth-galileo": "PIA00405",
  "gallery:mars-rover-panorama": "PIA00782",
  "gallery:venus-aphrodite-terra": "PIA00248",
  "gallery:crab-nebula-nasa": "PIA03606",
  "gallery:helix-nebula": "PIA09178",
  "gallery:m94-galaxy": "PIA17011",
  "gallery:earth-blue-marble": "PIA18033",
  "gallery:triangulum-galaxy": "PIA11969",
  "gallery:whirlpool-galaxy": "PIA10200",
  "gallery:sombrero-galaxy": "0700064",
  "gallery:centaurus-a": "PIA04624",
  "gallery:large-magellanic-cloud": "iss071e418742",
  "gallery:small-magellanic-cloud": "PIA25164",
  "gallery:lagoon-nebula": "GSFC_20171208_Archive_e001955",
  "gallery:ring-nebula": "PIA14443",
  "gallery:dumbbell-nebula": "PIA04249",
  "gallery:pleiades": "PIA14096",
  "gallery:hyades": "GSFC_20171208_Archive_e001500",
  "gallery:omega-centauri": "PIA10372",
  "reference:mercury:mercury-object-photo": "PIA16908",
  "reference:earth:earth-object-photo": "PIA00342",
  "reference:jupiter:jupiter-object-photo": "PIA09231",
  "reference:venus:venus-object-photo": "PIA00248",
  "reference:mars:mars-object-photo": "PIA00782",
  "reference:saturn:saturn-object-photo": "PIA06423",
  "reference:uranus:uranus-object-photo": "PIA01391",
  "reference:neptune:neptune-object-photo": "PIA02210",
  "reference:moon:moon-object-photo": "PIA12235",
  "reference:sun:sun-object-photo": "PIA18906",
  "reference:andromeda-galaxy:andromeda-galaxy-object-photo": "PIA04921",
  "reference:orion-nebula:orion-nebula-object-photo": "PIA04227",
  "reference:triangulum-galaxy:triangulum-galaxy-object-photo": "PIA11969",
  "reference:whirlpool-galaxy:whirlpool-galaxy-object-photo": "PIA10200",
  "reference:sombrero-galaxy:sombrero-galaxy-object-photo": "0700064",
  "reference:centaurus-a:centaurus-a-object-photo": "PIA04624",
  "reference:large-magellanic-cloud:large-magellanic-cloud-object-photo": "iss071e418742",
  "reference:small-magellanic-cloud:small-magellanic-cloud-object-photo": "PIA25164",
  "reference:lagoon-nebula:lagoon-nebula-object-photo": "GSFC_20171208_Archive_e001955",
  "reference:ring-nebula:ring-nebula-object-photo": "PIA14443",
  "reference:dumbbell-nebula:dumbbell-nebula-object-photo": "PIA04249",
  "reference:pleiades:pleiades-object-photo": "PIA14096",
  "reference:hyades:hyades-object-photo": "GSFC_20171208_Archive_e001500",
  "reference:omega-centauri:omega-centauri-object-photo": "PIA10372",
};

const additionalGalleryAssets = [
  {
    assetKey: "gallery:twilight-conjunction",
    sourceId: "NHQ202012130001",
    galleryCategory: "sky_events",
    title: "暮光中的木星与土星",
    description: "在地球上拍摄的晨昏天空与行星合相，作为早霞、晚霞和行星观测的真实参考。",
    altText: "暮光天空中的木星与土星",
    location: "Shenandoah National Park, USA",
    capturedAt: "2020-12-13",
    equipment: "地面天文摄影",
  },
  {
    assetKey: "gallery:evening-planet-conjunction",
    sourceId: "NHQ202012210001",
    galleryCategory: "sky_events",
    title: "晚霞中的行星合相",
    description: "地面拍摄的晚霞与行星合相影像，展示实际天空中目标和地平线的关系。",
    altText: "晚霞中的行星合相",
    location: "Chapel Hill, North Carolina, USA",
    capturedAt: "2020-12-21",
    equipment: "地面天文摄影",
  },
  {
    assetKey: "gallery:perseid-meteor-shower",
    sourceId: "NHQ202508030001",
    galleryCategory: "sky_events",
    title: "英仙座流星雨",
    description: "地面长曝光记录的流星雨，展示流星雨在真实夜空中的观感。",
    altText: "英仙座流星划过夜空",
    location: "Spruce Knob Mountain, West Virginia, USA",
    capturedAt: "2025-08-03",
    equipment: "30秒地面长曝光",
  },
  {
    assetKey: "gallery:international-space-station",
    sourceId: "iss065e214537",
    galleryCategory: "satellites",
    title: "国际空间站视角下的地球夜空",
    description: "国际空间站拍摄的地球大气辉光与夜间地表，作为人造卫星和轨道观测专题的机构影像。",
    altText: "国际空间站拍摄的地球夜空",
    location: "International Space Station",
    capturedAt: "2021-08-02",
    equipment: "International Space Station camera",
  },
  {
    assetKey: "gallery:earth-aurora",
    sourceId: "iss058e005282",
    galleryCategory: "earth_sky",
    title: "地球极光与大气层",
    description: "从轨道观察地球极光和大气层结构，补充地面天空摄影之外的地球环境视角。",
    altText: "地球极光与大气层",
    location: "International Space Station",
    capturedAt: "2019-01-",
    equipment: "International Space Station camera",
  },
  {
    assetKey: "gallery:moon-and-earth-galileo",
    sourceId: "PIA00405",
    galleryCategory: "solar_system",
    objectSlug: "moon",
    title: "地月同框",
    description: "伽利略号从深空回望地球与月球，作为月球详情页之外的地月系统视角。",
    altText: "伽利略号拍摄的地球与月球",
    location: "Galileo spacecraft observation",
    capturedAt: "1992-12-07",
    equipment: "Galileo spacecraft",
  },
  {
    assetKey: "gallery:mars-rover-panorama",
    sourceId: "PIA00782",
    galleryCategory: "solar_system",
    objectSlug: "mars",
    title: "火星地表全景",
    description: "火星车拍摄的地表全景，把火星详情页中的行星本体延伸到真实地表环境。",
    altText: "火星车拍摄的火星地表全景",
    location: "Mars, photographed by a Mars Exploration Rover",
    capturedAt: "See NASA source page",
    equipment: "Mars Exploration Rover panoramic camera",
  },
  {
    assetKey: "gallery:venus-aphrodite-terra",
    sourceId: "PIA00248",
    galleryCategory: "solar_system",
    objectSlug: "venus",
    title: "金星阿佛洛狄忒高地",
    description: "麦哲伦号雷达观测得到的金星地表区域，展示云层之下的真实地形主题。",
    altText: "麦哲伦号观测的金星阿佛洛狄忒高地",
    location: "Venus, Magellan spacecraft radar observation",
    capturedAt: "See NASA source page",
    equipment: "Magellan spacecraft radar",
  },
  {
    assetKey: "gallery:crab-nebula-nasa",
    sourceId: "PIA03606",
    galleryCategory: "deep_space",
    objectSlug: "crab-nebula",
    title: "蟹状星云",
    description: "专业机构拍摄的超新星遗迹，展示星云、脉冲星和深空结构的另一种尺度。",
    altText: "NASA拍摄的蟹状星云",
    location: "Crab Nebula",
    capturedAt: "See NASA source page",
    equipment: "NASA space telescope observations",
  },
  {
    assetKey: "gallery:helix-nebula",
    sourceId: "PIA09178",
    galleryCategory: "deep_space",
    title: "螺旋星云",
    description: "斯皮策空间望远镜捕捉的行星状星云，补充与猎户座大星云不同的深空对象。",
    altText: "斯皮策空间望远镜拍摄的螺旋星云",
    location: "Helix Nebula",
    capturedAt: "See NASA source page",
    equipment: "Spitzer Space Telescope",
  },
  {
    assetKey: "gallery:m94-galaxy",
    sourceId: "PIA17011",
    galleryCategory: "deep_space",
    title: "梅西耶94星系",
    description: "哈勃望远镜拍摄的星系结构，作为仙女座之外的另一个完整星系样本。",
    altText: "哈勃望远镜拍摄的梅西耶94星系",
    location: "Messier 94 galaxy",
    capturedAt: "See NASA source page",
    equipment: "Hubble Space Telescope",
  },
  {
    assetKey: "gallery:earth-blue-marble",
    sourceId: "PIA18033",
    galleryCategory: "solar_system",
    objectSlug: "earth",
    title: "地球蓝色弹珠",
    description: "从深空观察地球的代表性影像，连接地球详情页与太阳系尺度。",
    altText: "从深空拍摄的地球",
    location: "Earth, observed from deep space",
    capturedAt: "See NASA source page",
    equipment: "NASA Earth-observing spacecraft",
  },
];

for (const asset of additionalGalleryAssets) sourceByAssetKey[asset.assetKey] = asset.sourceId;

const sourceCache = new Map();

function storagePathFor(assetKey) {
  const [kind, ...parts] = assetKey.split(":");
  return `${kind === "gallery" ? "gallery" : "object-reference"}/${parts.join("-")}.jpg`;
}

async function nasaImageUrl(nasaId) {
  if (!sourceCache.has(nasaId)) {
    const response = await fetch(`https://images-assets.nasa.gov/image/${encodeURIComponent(nasaId)}/collection.json`);
    if (!response.ok) throw new Error(`NASA asset list failed for ${nasaId}: HTTP ${response.status}`);
    const assets = await response.json();
    const priorities = ["large", "medium", "small", "orig"];
    const asset = priorities
      .flatMap((size) => assets.filter((item) => new RegExp(`~${size}\\.(jpg|jpeg|png)$`, "i").test(item)))
      .find(Boolean);
    if (!asset) throw new Error(`NASA image file not found for ${nasaId}`);
    sourceCache.set(nasaId, String(asset).replace(/^http:/, "https:"));
  }
  return sourceCache.get(nasaId);
}

async function downloadImage(imageUrl, destination) {
  const response = await fetch(imageUrl, {
    headers: { "User-Agent": "Echo-of-Photons/0.1 media migration" },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`Image download failed for ${imageUrl}: HTTP ${response.status}`);
  const input = Buffer.from(await response.arrayBuffer());
  const output = await sharp(input)
    .rotate()
    .resize({ width: 1800, withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, output);
  return output;
}

async function uploadImage(storagePath, image) {
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${storagePath.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "image/jpeg",
        "x-upsert": "true",
      },
      body: image,
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase upload failed for ${storagePath}: HTTP ${response.status} ${body}`);
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();

try {
  for (const asset of additionalGalleryAssets) {
    await client.query(
      `INSERT INTO media_assets
        (asset_key, media_type, gallery_category, object_id, title, description, alt_text,
          external_url, source_url, credit, location, captured_at, equipment, license, sort_order, is_active)
       VALUES ($1, 'gallery', $2,
               (SELECT id FROM celestial_objects WHERE slug = $3 AND is_active = true),
               $4, $5, $6, $7, $7, 'NASA Image and Video Library', $8, $9, $10,
               'NASA public domain / see source page', $11, true)
       ON CONFLICT (asset_key) DO UPDATE SET
         gallery_category = EXCLUDED.gallery_category,
         object_id = COALESCE(EXCLUDED.object_id, media_assets.object_id),
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         alt_text = EXCLUDED.alt_text,
         source_url = EXCLUDED.source_url,
         credit = EXCLUDED.credit,
         location = EXCLUDED.location,
         captured_at = EXCLUDED.captured_at,
         equipment = EXCLUDED.equipment,
         license = EXCLUDED.license,
         sort_order = EXCLUDED.sort_order,
         is_active = true,
         updated_at = NOW()` ,
      [
        asset.assetKey,
        asset.galleryCategory,
        asset.objectSlug ?? null,
        asset.title,
        asset.description,
        asset.altText,
        `https://images.nasa.gov/details-${asset.sourceId}`,
        asset.location,
        asset.capturedAt,
        asset.equipment,
        ["sky_events", "satellites", "earth_sky"].includes(asset.galleryCategory)
          ? 10 + additionalGalleryAssets.indexOf(asset) * 10
          : 300 + (additionalGalleryAssets.indexOf(asset) - 5) * 10,
      ],
    );
  }

  const result = await client.query(
    `SELECT asset_key, media_type, storage_bucket, storage_path
     FROM media_assets
     WHERE media_type IN ('gallery', 'object_reference') AND is_active = true
     ORDER BY asset_key`,
  );

  let migrated = 0;
  let skipped = 0;
  for (const row of result.rows) {
    const nasaId = sourceByAssetKey[row.asset_key];
    const imageUrl = nasaId
      ? await nasaImageUrl(nasaId)
      : row.external_url;
    if (!imageUrl) throw new Error(`No image source configured for ${row.asset_key}`);
    if (!force && row.storage_bucket && row.storage_path) {
      await client.query(
        `UPDATE media_assets SET external_url = $1, updated_at = NOW() WHERE asset_key = $2`,
        [imageUrl, row.asset_key],
      );
      console.log(`skip ${row.asset_key}: already migrated`);
      skipped += 1;
      continue;
    }

    const storagePath = storagePathFor(row.asset_key);
    const localPath = path.join(mediaRoot, storagePath);
    console.log(`${dryRun ? "check" : "migrate"} ${row.asset_key} <- ${nasaId ? `NASA ${nasaId}` : imageUrl}`);
    if (dryRun) continue;

    const image = await downloadImage(imageUrl, localPath);
    await uploadImage(storagePath, image);
    await client.query(
      `UPDATE media_assets
       SET storage_bucket = $1,
           storage_path = $2,
           external_url = $3,
           source_url = $4,
           credit = 'NASA Image and Video Library',
           license = 'NASA public domain / see source page',
           updated_at = NOW()
        WHERE asset_key = $5`,
      [bucket, storagePath, imageUrl, `https://images.nasa.gov/details-${nasaId}`, row.asset_key],
    );
    migrated += 1;
  }

  console.log(`${dryRun ? "Media migration check" : "Media migration complete"}: ${migrated} migrated, ${skipped} skipped, ${result.rowCount} total.`);
} finally {
  client.release();
  await pool.end();
}
