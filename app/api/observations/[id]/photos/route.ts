import { randomUUID } from "node:crypto";
import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";
import { query } from "@/data-access/db";
import { getCurrentUser } from "@/lib/auth/session";
import { attachObserverCookie, getObserverIdentity } from "@/lib/observer-identity";
import {
  createObservationPhotoUrl,
  deleteObservationPhoto,
  extensionForMimeType,
  uploadObservationPhoto,
  validateObservationPhoto,
} from "@/lib/observation-photo-storage";

interface PhotoRow {
  id: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  created_at: Date | string;
}

function parseId(rawId: string): number | null {
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function mapPhoto(row: PhotoRow, url: string) {
  return {
    id: Number(row.id),
    url,
    originalName: row.original_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function getOwnerContext() {
  const user = await getCurrentUser();
  const observer = await getObserverIdentity();
  return { user, observer, ownerId: user?.id ?? observer.id };
}

async function hasOwnedObservation(observationId: number, userId: number | string, observerId: string, user: { id: number } | null) {
  const rows = await query<{ id: number }>(
    `SELECT id
     FROM observation_records
     WHERE id = $1 AND ${user ? "user_id = $2" : "observer_id = $2 AND user_id IS NULL"}`,
    [observationId, user ? userId : observerId],
  );
  return rows.length > 0;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const observationId = parseId((await params).id);
  if (!observationId) return apiError(ErrorCode.INVALID_PARAMS, "invalid observation id");

  try {
    const { user, observer, ownerId } = await getOwnerContext();
    if (!(await hasOwnedObservation(observationId, ownerId, observer.id, user))) {
      return apiError(ErrorCode.NOT_FOUND, "observation not found");
    }
    const rows = await query<PhotoRow>(
      `SELECT id::text, storage_path, original_name, mime_type, file_size, created_at
       FROM observation_photos
       WHERE observation_id = $1 AND ${user ? "user_id = $2" : "observer_id = $2 AND user_id IS NULL"}
       ORDER BY created_at ASC`,
      [observationId, ownerId],
    );
    const photos = await Promise.all(rows.map(async (row) => mapPhoto(row, await createObservationPhotoUrl(row.storage_path))));
    return apiSuccess({ photos });
  } catch {
    return apiError(ErrorCode.INTERNAL_ERROR, "failed to load observation photos");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const observationId = parseId((await params).id);
  if (!observationId) return apiError(ErrorCode.INVALID_PARAMS, "invalid observation id");

  let observer: Awaited<ReturnType<typeof getObserverIdentity>>;
  try {
    const owner = await getOwnerContext();
    observer = owner.observer;
    if (!(await hasOwnedObservation(observationId, owner.ownerId, owner.observer.id, owner.user))) {
      return apiError(ErrorCode.NOT_FOUND, "observation not found");
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return apiError(ErrorCode.INVALID_PARAMS, "photo file is required");
    const validationError = validateObservationPhoto(file);
    if (validationError) return apiError(ErrorCode.INVALID_PARAMS, validationError);

    const storagePath = `observations/${observationId}/${owner.ownerId}/${randomUUID()}.${extensionForMimeType(file.type)}`;
    await uploadObservationPhoto(storagePath, await file.arrayBuffer(), file.type);

    try {
      const rows = await query<PhotoRow>(
        `INSERT INTO observation_photos
          (observation_id, observer_id, user_id, storage_path, original_name, mime_type, file_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id::text, storage_path, original_name, mime_type, file_size, created_at`,
        [observationId, owner.observer.id, owner.user?.id ?? null, storagePath, file.name.slice(0, 255), file.type, file.size],
      );
      const photo = mapPhoto(rows[0], await createObservationPhotoUrl(storagePath));
      const secureCookie = new URL(request.url).protocol === "https:";
      return attachObserverCookie(apiSuccess({ photo }, "observation photo uploaded"), observer, secureCookie);
    } catch (error) {
      try {
        await deleteObservationPhoto(storagePath);
      } catch {
        // Keep the original database error as the response; an orphan can be cleaned up later.
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return apiError(ErrorCode.INTERNAL_ERROR, "photo storage is not configured on the server");
    }
    console.error("observation photo upload failed", error instanceof Error ? error.message : error);
    return apiError(ErrorCode.INTERNAL_ERROR, "failed to upload observation photo");
  }
}
