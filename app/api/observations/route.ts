import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";
import { query } from "@/data-access/db";
import { syncUserAchievementUnlocks } from "@/lib/achievements/progress";
import { getCurrentUser } from "@/lib/auth/session";
import { attachObserverCookie, getObserverIdentity } from "@/lib/observer-identity";
import { createObservationPhotoUrl, isObservationPhotoStorageConfigured } from "@/lib/observation-photo-storage";

interface ObservationPhotoRow {
  id: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  created_at: Date | string;
}

interface ObservationRow {
  id: string;
  target_slug: string | null;
  target_name: string;
  object_type: string;
  observed_at: Date | string;
  latitude: number | string | null;
  longitude: number | string | null;
  location_name: string | null;
  equipment: string | null;
  notes: string | null;
  confirmed_at: Date | string | null;
  created_at: Date | string;
  photos: ObservationPhotoRow[] | null;
}

function isMissingPhotosTable(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "42P01"
    && "message" in error
    && String(error.message).includes("observation_photos");
}

async function loadObservationRows(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  observerId: string,
  includePhotos: boolean,
) {
  const ownerCondition = user ? "user_id = $1" : "observer_id = $1 AND user_id IS NULL";
  const photosSelect = includePhotos
    ? `COALESCE((
                SELECT json_agg(json_build_object(
                  'id', p.id::text,
                  'storage_path', p.storage_path,
                  'original_name', p.original_name,
                  'mime_type', p.mime_type,
                  'file_size', p.file_size,
                  'created_at', p.created_at
                ) ORDER BY p.created_at ASC)
                FROM observation_photos p
                WHERE p.observation_id = observation_records.id
              ), '[]'::json)`
    : "'[]'::json";

  return query<ObservationRow>(
    `SELECT id::text, target_slug, target_name, object_type, observed_at,
            latitude::float8 AS latitude, longitude::float8 AS longitude,
            location_name, equipment, notes, confirmed_at, created_at,
            ${photosSelect} AS photos
     FROM observation_records
     WHERE ${ownerCondition}
     ORDER BY observed_at DESC, created_at DESC
     LIMIT 100`,
    [user?.id ?? observerId],
  );
}

function textValue(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const valueTrimmed = value.trim();
  return valueTrimmed ? valueTrimmed.slice(0, maxLength) : null;
}

function numberValue(value: unknown, min: number, max: number): number | null | undefined {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return undefined;
  return parsed;
}

function dateValue(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapRecord(row: ObservationRow) {
  return {
    id: Number(row.id),
    targetSlug: row.target_slug,
    targetName: row.target_name,
    objectType: row.object_type,
    observedAt: new Date(row.observed_at).toISOString(),
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    locationName: row.location_name,
    equipment: row.equipment,
    notes: row.notes,
    confirmedAt: row.confirmed_at == null ? null : new Date(row.confirmed_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    photos: [],
  };
}

async function mapRecordWithPhotos(row: ObservationRow) {
  const record = mapRecord(row);
  if (!row.photos?.length || !isObservationPhotoStorageConfigured()) return record;
  try {
    const photos = await Promise.all(row.photos.map(async (photo) => ({
      id: Number(photo.id),
      url: await createObservationPhotoUrl(photo.storage_path),
      originalName: photo.original_name,
      mimeType: photo.mime_type,
      fileSize: photo.file_size,
      createdAt: new Date(photo.created_at).toISOString(),
    })));
    return { ...record, photos };
  } catch {
    return record;
  }
}

export async function GET(request: Request) {
  try {
    const observer = await getObserverIdentity();
    const user = await getCurrentUser();
    const secureCookie = new URL(request.url).protocol === "https:";
    let rows: ObservationRow[];
    try {
      rows = await loadObservationRows(user, observer.id, true);
    } catch (error) {
      if (!isMissingPhotosTable(error)) throw error;
      console.warn("observation_photos table is missing; loading records without photos");
      rows = await loadObservationRows(user, observer.id, false);
    }

    return attachObserverCookie(
      apiSuccess({ records: await Promise.all(rows.map(mapRecordWithPhotos)), account: user }),
      observer,
      secureCookie,
    );
  } catch (error) {
    console.error("observation records GET failed", error);
    return apiError(ErrorCode.INTERNAL_ERROR, "observation records unavailable");
  }
}

export async function POST(request: Request) {
  const observer = await getObserverIdentity();
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return apiError(ErrorCode.INTERNAL_ERROR, "account lookup failed");
  }
  const secureCookie = new URL(request.url).protocol === "https:";
  let body: Record<string, unknown>;

  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return apiError(ErrorCode.INVALID_PARAMS, "request body must be an object");
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return apiError(ErrorCode.INVALID_PARAMS, "invalid JSON body");
  }

  const targetName = textValue(body.targetName, 255);
  const observedAt = dateValue(body.observedAt);
  const latitude = numberValue(body.latitude, -90, 90);
  const longitude = numberValue(body.longitude, -180, 180);
  const targetSlug = textValue(body.targetSlug, 255);
  const objectType = textValue(body.objectType, 50) ?? "unknown";
  const locationName = textValue(body.locationName, 255);
  const equipment = textValue(body.equipment, 255);
  const notes = textValue(body.notes, 4000);
  const confirmed = body.confirmed === true;

  if (!targetName || !observedAt || latitude === undefined || longitude === undefined) {
    return apiError(ErrorCode.INVALID_PARAMS, "targetName, observedAt, latitude and longitude are invalid");
  }

  try {
    const rows = await query<ObservationRow>(
      `INSERT INTO observation_records
        (observer_id, user_id, target_slug, target_name, object_type, observed_at,
         latitude, longitude, location_name, equipment, notes, confirmed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id::text, target_slug, target_name, object_type, observed_at,
                 latitude::float8 AS latitude, longitude::float8 AS longitude,
                 location_name, equipment, notes, confirmed_at, created_at`,
      [observer.id, user?.id ?? null, targetSlug, targetName, objectType, observedAt, latitude, longitude, locationName, equipment, notes, confirmed ? new Date().toISOString() : null],
    );
    let newlyUnlocked: Awaited<ReturnType<typeof syncUserAchievementUnlocks>> = [];
    if (confirmed && user) {
      try {
        newlyUnlocked = await syncUserAchievementUnlocks(user.id);
      } catch (error) {
        console.error("achievement unlock sync failed after confirmed observation", error);
      }
    }

    return attachObserverCookie(
      apiSuccess({ record: mapRecord(rows[0]), newlyUnlocked }, "observation recorded"),
      observer,
      secureCookie,
    );
  } catch {
    return apiError(ErrorCode.INTERNAL_ERROR, "failed to save observation record");
  }
}
