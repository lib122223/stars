import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const response = apiSuccess({ user: await getCurrentUser() });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("current user lookup failed", error);
    return apiError(ErrorCode.INTERNAL_ERROR, "account lookup failed");
  }
}
