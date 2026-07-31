import { query } from "@/data-access/db";

interface MediaSourceRow {
  storage_bucket: string | null;
  storage_path: string | null;
  external_url: string | null;
}

const nasaImagePattern = /^https:\/\/images-assets\.nasa\.gov\/image\/([^/]+)\/[^/]+~[^.]+\.jpg(?:\?.*)?$/i;
const nasaDetailsPattern = /^https:\/\/images\.nasa\.gov\/details-([^/?#]+)$/i;

async function resolveNasaImageSource(source: string): Promise<string[]> {
  const imageMatch = source.match(nasaImagePattern);
  const detailsMatch = source.match(nasaDetailsPattern);
  if (!imageMatch && !detailsMatch) return [source];

  const nasaId = decodeURIComponent(imageMatch?.[1] ?? detailsMatch![1]);
  try {
    const response = await fetch(
      `https://images-assets.nasa.gov/image/${encodeURIComponent(nasaId)}/collection.json`,
      {
        headers: { "User-Agent": "Echo-of-Photons/0.1 media proxy" },
        signal: AbortSignal.timeout(12_000),
        cache: "force-cache",
      },
    );
    if (!response.ok) return [source];

    const assets = (await response.json()) as unknown;
    if (!Array.isArray(assets)) return [source];

    const files = assets.filter((asset): asset is string => typeof asset === "string");
    const priorities = ["orig", "large", "medium", "small", "thumb"];
    const selected = priorities
      .flatMap((size) => files.filter((file) => new RegExp(`~${size}\\.(jpg|jpeg|png)$`, "i").test(file)))
      .find(Boolean);
    if (!selected) return [source];
    return [String(selected).replace(/^http:/, "https:")];
  } catch {
    return [source];
  }
}

function storagePublicUrl(row: MediaSourceRow): string | null {
  if (!row.storage_bucket || !row.storage_path || !process.env.SUPABASE_URL) return null;
  const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, "");
  const bucket = encodeURIComponent(row.storage_bucket);
  const path = row.storage_path.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetKey: string }> },
) {
  const { assetKey } = await params;
  const rows = await query<MediaSourceRow>(
    `SELECT storage_bucket, storage_path, external_url
     FROM media_assets
     WHERE asset_key = $1 AND is_active = true
     LIMIT 1`,
    [assetKey],
  );
  if (!rows[0]) return new Response("media source not found", { status: 404 });

  const sources = [storagePublicUrl(rows[0]), rows[0].external_url].filter(
    (source): source is string => Boolean(source),
  );
  for (const source of sources) {
    for (const candidate of await resolveNasaImageSource(source)) {
      try {
        const response = await fetch(candidate, {
          headers: { "User-Agent": "Echo-of-Photons/0.1 media proxy" },
          signal: AbortSignal.timeout(30_000),
          cache: "force-cache",
        });
        if (!response.ok) continue;
        const contentType = response.headers.get("content-type") ?? "image/jpeg";
        if (!contentType.startsWith("image/")) continue;
        return new Response(await response.arrayBuffer(), {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          },
        });
      } catch {
        continue;
      }
    }
  }
  return new Response("media source unavailable", { status: 502 });
}
