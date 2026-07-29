import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";
import { predictIssPasses } from "@/lib/satellite-passes";

function parseCoordinate(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = parseCoordinate(searchParams.get("lat"));
  const longitude = parseCoordinate(searchParams.get("lng"));

  if (latitude == null || latitude < -90 || latitude > 90) {
    return apiError(ErrorCode.INVALID_PARAMS, "lat must be between -90 and 90");
  }
  if (longitude == null || longitude < -180 || longitude > 180) {
    return apiError(ErrorCode.INVALID_PARAMS, "lng must be between -180 and 180");
  }

  try {
    return apiSuccess(await predictIssPasses(latitude, longitude));
  } catch (error) {
    console.error("ISS pass prediction failed", error);
    return apiError(ErrorCode.INTERNAL_ERROR, "ISS pass prediction is temporarily unavailable");
  }
}
