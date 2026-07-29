import { apiSuccess } from "@/lib/api-response";
import { clearSessionCookie, deleteCurrentSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    await deleteCurrentSession();
  } catch (error) {
    console.error("session deletion failed during logout", error);
  }

  const secure = new URL(request.url).protocol === "https:";
  const response = clearSessionCookie(apiSuccess({ signedOut: true }, "signed out"), secure);
  console.info("auth.audit", {
    actorUserId: null,
    occurredAt: new Date().toISOString(),
    action: "logout",
    target: "session",
    result: "success",
  });
  return response;
}
