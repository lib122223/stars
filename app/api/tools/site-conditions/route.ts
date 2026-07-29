import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";
import { fetchObservationSnapshot } from "@/lib/observation-snapshot";

function parseCoord(raw: string | null): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseCoord(searchParams.get("lat"));
  const lng = parseCoord(searchParams.get("lng"));

  if (lat == null || lat < -90 || lat > 90) {
    return apiError(ErrorCode.INVALID_PARAMS, "lat must be between -90 and 90");
  }
  if (lng == null || lng < -180 || lng > 180) {
    return apiError(ErrorCode.INVALID_PARAMS, "lng must be between -180 and 180");
  }

  try {
    const conditions = await fetchObservationSnapshot(lat, lng);
    return apiSuccess(conditions);
  } catch {
    return apiError(ErrorCode.INTERNAL_ERROR, "site conditions lookup failed");
  }
}
