import { getClient } from "@/data-access/db";
import { apiError, apiSuccess, ErrorCode } from "@/lib/api-response";
import { syncUserAchievementUnlocks } from "@/lib/achievements/progress";
import { hashPassword, normalizeEmail, passwordValidationError } from "@/lib/auth/credentials";
import { attachSessionCookie, createSession, type AuthUser } from "@/lib/auth/session";
import { attachObserverCookie, getObserverIdentity } from "@/lib/observer-identity";

interface CreatedUserRow {
  id: string;
  email: string;
  created_at: Date | string;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error != null && "code" in error && error.code === "23505";
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
  const passwordError = passwordValidationError(body.password);
  if (!email) return apiError(ErrorCode.INVALID_PARAMS, "请输入有效的邮箱地址");
  if (passwordError) return apiError(ErrorCode.INVALID_PARAMS, passwordError);

  const password = body.password as string;
  let client: Awaited<ReturnType<typeof getClient>> | null = null;

  try {
    const passwordHash = await hashPassword(password);
    const observer = await getObserverIdentity();
    client = await getClient();
    await client.query("BEGIN");
    const userResult = await client.query<CreatedUserRow>(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id::text, email, created_at`,
      [email, passwordHash],
    );
    const row = userResult.rows[0];
    const userId = Number(row.id);
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
      console.warn("observation_photos table is missing during registration claim");
    }
    await syncUserAchievementUnlocks(userId, client);
    const session = await createSession(client, userId);
    await client.query("COMMIT");

    const user: AuthUser = {
      id: userId,
      email: row.email,
      emailVerified: false,
      createdAt: new Date(row.created_at).toISOString(),
    };
    const secure = new URL(request.url).protocol === "https:";
    let response = apiSuccess({ user, claimedRecords: claimed.rowCount ?? 0 }, "account created");
    response = attachObserverCookie(response, observer, secure);
    response = attachSessionCookie(response, session.token, session.expiresAt, secure);

    console.info("auth.audit", {
      actorUserId: userId,
      occurredAt: new Date().toISOString(),
      action: "register",
      target: "account",
      result: "success",
    });
    return response;
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => undefined);
    if (isUniqueViolation(error)) {
      return apiError(ErrorCode.CONFLICT, "该邮箱已注册");
    }
    console.error("auth registration failed", error);
    return apiError(ErrorCode.INTERNAL_ERROR, "account registration failed");
  } finally {
    client?.release();
  }
}
