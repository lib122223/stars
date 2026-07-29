import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";
import { loadAchievementCenterData } from "@/lib/achievements/progress";
import { getCurrentUser } from "@/lib/auth/session";
import { attachObserverCookie, getObserverIdentity } from "@/lib/observer-identity";

export async function GET(request: Request) {
  try {
    const observer = await getObserverIdentity();
    const user = await getCurrentUser();
    const data = await loadAchievementCenterData({
      userId: user?.id ?? null,
      observerId: observer.id,
      email: user?.email ?? null,
    });
    const secureCookie = new URL(request.url).protocol === "https:";

    return attachObserverCookie(
      apiSuccess(data),
      observer,
      secureCookie,
    );
  } catch (error) {
    console.error("achievements GET failed", error);
    return apiError(ErrorCode.INTERNAL_ERROR, "achievements unavailable");
  }
}
