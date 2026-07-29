import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";
import { query } from "@/data-access/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getObserverIdentity } from "@/lib/observer-identity";
import { deleteObservationPhoto } from "@/lib/observation-photo-storage";

interface PhotoRow {
  storage_path: string;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const { id, photoId } = await params;
  const observationId = Number(id);
  const recordPhotoId = Number(photoId);
  if (!Number.isSafeInteger(observationId) || observationId <= 0 || !Number.isSafeInteger(recordPhotoId) || recordPhotoId <= 0) {
    return apiError(ErrorCode.INVALID_PARAMS, "invalid photo id");
  }

  try {
    const user = await getCurrentUser();
    const observer = await getObserverIdentity();
    const ownerId = user?.id ?? observer.id;
    const rows = await query<PhotoRow>(
      `SELECT p.storage_path
       FROM observation_photos p
       WHERE p.id = $1 AND p.observation_id = $2
         AND ${user ? "p.user_id = $3" : "p.observer_id = $3 AND p.user_id IS NULL"}`,
      [recordPhotoId, observationId, ownerId],
    );
    if (rows.length === 0) return apiError(ErrorCode.NOT_FOUND, "observation photo not found");

    await deleteObservationPhoto(rows[0].storage_path);
    await query(
      `DELETE FROM observation_photos WHERE id = $1 AND observation_id = $2`,
      [recordPhotoId, observationId],
    );
    return apiSuccess({ id: recordPhotoId }, "observation photo deleted");
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return apiError(ErrorCode.INTERNAL_ERROR, "photo storage is not configured on the server");
    }
    return apiError(ErrorCode.INTERNAL_ERROR, "failed to delete observation photo");
  }
}
