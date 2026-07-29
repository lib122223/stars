const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const OBSERVATION_PHOTO_MAX_SIZE = MAX_PHOTO_SIZE;
export const OBSERVATION_PHOTO_MIME_TYPES = SUPPORTED_MIME_TYPES;

function getStorageConfig() {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "observation-photos";
  if (!baseUrl || !serviceRoleKey) return null;
  return { baseUrl, serviceRoleKey, bucket };
}

export function isObservationPhotoStorageConfigured(): boolean {
  return getStorageConfig() != null;
}

function storagePathUrl(config: NonNullable<ReturnType<typeof getStorageConfig>>, path: string): string {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${config.baseUrl}/storage/v1/object/${encodeURIComponent(config.bucket)}/${encodedPath}`;
}

export async function uploadObservationPhoto(path: string, body: ArrayBuffer, contentType: string) {
  const config = getStorageConfig();
  if (!config) throw new Error("observation photo storage is not configured");
  const response = await fetch(storagePathUrl(config, path), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.serviceRoleKey,
      "Content-Type": contentType,
      "x-upsert": "false",
    },
    body,
  });
  if (!response.ok) throw new Error(`storage upload failed: ${response.status}`);
}

export async function deleteObservationPhoto(path: string) {
  const config = getStorageConfig();
  if (!config) throw new Error("observation photo storage is not configured");
  const response = await fetch(storagePathUrl(config, path), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.serviceRoleKey,
    },
  });
  if (!response.ok && response.status !== 404) throw new Error(`storage delete failed: ${response.status}`);
}

export async function createObservationPhotoUrl(path: string): Promise<string> {
  const config = getStorageConfig();
  if (!config) throw new Error("observation photo storage is not configured");
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    `${config.baseUrl}/storage/v1/object/sign/${encodeURIComponent(config.bucket)}/${encodedPath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.serviceRoleKey}`,
        apikey: config.serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 3600 }),
    },
  );
  if (!response.ok) throw new Error(`storage sign failed: ${response.status}`);
  const json = await response.json() as { signedURL?: string; signedUrl?: string };
  const signedPath = json.signedURL || json.signedUrl;
  if (!signedPath) throw new Error("storage sign response is invalid");
  return signedPath.startsWith("http")
    ? signedPath
    : `${config.baseUrl}/storage/v1${signedPath.startsWith("/") ? signedPath : `/${signedPath}`}`;
}

export function validateObservationPhoto(file: { size: number; type: string }) {
  if (!SUPPORTED_MIME_TYPES.has(file.type)) return "仅支持 JPG、PNG 和 WebP 图片";
  if (file.size <= 0 || file.size > MAX_PHOTO_SIZE) return "单张照片不能超过 5MB";
  return null;
}

export function extensionForMimeType(mimeType: string): string {
  return mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
}
