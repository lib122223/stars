import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";
import { query } from "@/data-access/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const simulate = searchParams.get("simulate");

  if (simulate === "error") {
    return apiError(ErrorCode.INTERNAL_ERROR, "simulated internal error");
  }

  if (simulate === "invalid") {
    return apiError(ErrorCode.INVALID_PARAMS, "simulated invalid params");
  }

  if (simulate != null) {
    return apiError(ErrorCode.INVALID_PARAMS, `unknown simulate value: ${simulate}`);
  }

  let db: "connected" | "disconnected" = "disconnected";
  try {
    const rows = await query<{ result: number }>("SELECT 1 AS result");
    db = rows[0]?.result === 1 ? "connected" : "disconnected";
  } catch {
    db = "disconnected";
  }

  const status = db === "connected" ? "healthy" : "unhealthy";
  return apiSuccess({ status, db });
}
