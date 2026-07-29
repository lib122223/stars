import { getClient, query } from "@/data-access/db";
import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";
import { syncUserAchievementUnlocks } from "@/lib/achievements/progress";
import { hashPassword, normalizeEmail, verifyPassword } from "@/lib/auth/credentials";
import {
  checkLoginRateLimit,
  clearLoginFailures,
  loginRateLimitKey,
  recordLoginFailure,
} from "@/lib/auth/rate-limit";
import { attachSessionCookie, createSession, type AuthUser } from "@/lib/auth/session";
import { attachObserverCookie, getObserverIdentity } from "@/lib/observer-identity";

interface LoginUserRow {
  id: string;
  email: string;
  password_hash: string;
  email_verified_at: Date | string | null;
  created_at: Date | string;
}

function isMissingPhotosTable(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "42P01"
    && "message" in error
    && String(error.message).includes("observation_photos");
}

export async function POST(request: Request) {
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

  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" && body.password.length <= 128
    ? body.password
    : null;
  if (!email || !password) return apiError(ErrorCode.INVALID_PARAMS, "邮箱或密码格式不正确");

  const rateLimitKey = loginRateLimitKey(request, email);
  const rateLimit = checkLoginRateLimit(rateLimitKey);
  if (!rateLimit.allowed) {
    const response = apiError(ErrorCode.RATE_LIMITED, "尝试次数过多，请稍后再试");
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return response;
  }

  try {
    const rows = await query<LoginUserRow>(
      `SELECT id::text, email, password_hash, email_verified_at, created_at
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email],
    );
    const row = rows[0];
    const passwordMatches = row
      ? await verifyPassword(row.password_hash, password)
      : (await hashPassword(password), false);

    if (!row || !passwordMatches) {
      recordLoginFailure(rateLimitKey);
      console.info("auth.audit", {
        actorUserId: null,
        occurredAt: new Date().toISOString(),
        action: "login",
        target: "session",
        result: "invalid_credentials",
      });
      return apiError(ErrorCode.UNAUTHORIZED, "邮箱或密码不正确");
    }

    const observer = await getObserverIdentity();
    const userId = Number(row.id);
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const claimed = await client.query(
        `UPDATE observation_records
         SET user_id = $1, updated_at = NOW()
         WHERE observer_id = $2 AND user_id IS NULL
         RETURNING id`,
        [userId, observer.id],
      );
      try {
        await client.query(
          `UPDATE observation_photos
           SET user_id = $1
           WHERE observer_id = $2 AND user_id IS NULL`,
          [userId, observer.id],
        );
      } catch (error) {
        if (!isMissingPhotosTable(error)) throw error;
        console.warn("observation_photos table is missing during login claim");
      }
      await syncUserAchievementUnlocks(userId, client);
      const session = await createSession(client, userId);
      await client.query("COMMIT");

      clearLoginFailures(rateLimitKey);
      const user: AuthUser = {
        id: userId,
        email: row.email,
        emailVerified: row.email_verified_at != null,
        createdAt: new Date(row.created_at).toISOString(),
      };
      const secure = new URL(request.url).protocol === "https:";
      let response = apiSuccess({ user, claimedRecords: claimed.rowCount ?? 0 }, "signed in");
      response = attachObserverCookie(response, observer, secure);
      response = attachSessionCookie(response, session.token, session.expiresAt, secure);

      console.info("auth.audit", {
        actorUserId: userId,
        occurredAt: new Date().toISOString(),
        action: "login",
        target: "session",
        result: "success",
      });
      return response;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("auth login failed", error);
    return apiError(ErrorCode.INTERNAL_ERROR, "account login failed");
  }
}
