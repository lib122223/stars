import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";
import { query } from "@/data-access/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getObserverIdentity } from "@/lib/observer-identity";

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
  created_at: Date | string;
}

function textValue(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
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
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function parseObservationBody(request: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    body = parsed as Record<string, unknown>;
  } catch {
    return null;
  }

  const targetName = textValue(body.targetName, 255);
  const observedAt = dateValue(body.observedAt);
  const latitude = numberValue(body.latitude, -90, 90);
  const longitude = numberValue(body.longitude, -180, 180);
  if (!targetName || !observedAt || latitude === undefined || longitude === undefined) return null;

  return {
    targetName,
    observedAt,
    latitude,
    longitude,
    targetSlug: textValue(body.targetSlug, 255),
    objectType: textValue(body.objectType, 50) ?? "unknown",
    locationName: textValue(body.locationName, 255),
    equipment: textValue(body.equipment, 255),
    notes: textValue(body.notes, 4000),
  };
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const recordId = Number(id);
  if (!Number.isSafeInteger(recordId) || recordId <= 0) {
    return apiError(ErrorCode.INVALID_PARAMS, "invalid observation id");
  }

  try {
    const user = await getCurrentUser();
    const observer = await getObserverIdentity();
    const rows = await query<{ id: number }>(
      `DELETE FROM observation_records
       WHERE id = $1 AND ${user ? "user_id = $2" : "observer_id = $2 AND user_id IS NULL"}
       RETURNING id`,
      [recordId, user?.id ?? observer.id],
    );

    if (rows.length === 0) {
      return apiError(ErrorCode.NOT_FOUND, "observation not found");
    }
    return apiSuccess({ id: recordId }, "observation deleted");
  } catch {
    return apiError(ErrorCode.INTERNAL_ERROR, "failed to delete observation record");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const recordId = Number(id);
  if (!Number.isSafeInteger(recordId) || recordId <= 0) {
    return apiError(ErrorCode.INVALID_PARAMS, "invalid observation id");
  }

  const body = await parseObservationBody(request);
  if (!body) {
    return apiError(ErrorCode.INVALID_PARAMS, "observation fields are invalid");
  }

  try {
    const user = await getCurrentUser();
    const observer = await getObserverIdentity();
    const rows = await query<ObservationRow>(
      `UPDATE observation_records
       SET target_slug = $2, target_name = $3, object_type = $4, observed_at = $5,
           latitude = $6, longitude = $7, location_name = $8, equipment = $9,
           notes = $10, updated_at = NOW()
       WHERE id = $1 AND ${user ? "user_id = $11" : "observer_id = $11 AND user_id IS NULL"}
       RETURNING id::text, target_slug, target_name, object_type, observed_at,
                 latitude::float8 AS latitude, longitude::float8 AS longitude,
                 location_name, equipment, notes, created_at`,
      [
        recordId,
        body.targetSlug,
        body.targetName,
        body.objectType,
        body.observedAt,
        body.latitude,
        body.longitude,
        body.locationName,
        body.equipment,
        body.notes,
        user?.id ?? observer.id,
      ],
    );

    if (rows.length === 0) {
      return apiError(ErrorCode.NOT_FOUND, "observation not found");
    }
    return apiSuccess({ record: mapRecord(rows[0]) }, "observation updated");
  } catch {
    return apiError(ErrorCode.INTERNAL_ERROR, "failed to update observation record");
  }
}
