import { cookies } from "next/headers";
import type { PoolClient } from "pg";
import type { NextResponse } from "next/server";
import { query } from "@/data-access/db";
import { createSessionToken, hashSessionToken } from "@/lib/auth/session-token";

export const SESSION_COOKIE = "echo_session";
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export interface AuthUser {
  id: number;
  email: string;
  emailVerified: boolean;
  createdAt: string;
}

interface SessionUserRow {
  id: string;
  email: string;
  email_verified_at: Date | string | null;
  created_at: Date | string;
}

function mapUser(row: SessionUserRow): AuthUser {
  return {
    id: Number(row.id),
    email: row.email,
    emailVerified: row.email_verified_at != null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function createSession(
  client: PoolClient,
  userId: number,
): Promise<{ token: string; expiresAt: Date }> {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await client.query(
    `INSERT INTO user_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hashSessionToken(token), expiresAt.toISOString()],
  );
  return { token, expiresAt };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;

  const rows = await query<SessionUserRow>(
    `SELECT users.id::text, users.email, users.email_verified_at, users.created_at
     FROM user_sessions
     JOIN users ON users.id = user_sessions.user_id
     WHERE user_sessions.token_hash = $1
       AND user_sessions.expires_at > NOW()
     LIMIT 1`,
    [hashSessionToken(token)],
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function deleteCurrentSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return;
  await query("DELETE FROM user_sessions WHERE token_hash = $1", [hashSessionToken(token)]);
}

export function attachSessionCookie<T>(
  response: NextResponse<T>,
  token: string,
  expiresAt: Date,
  secure: boolean,
): NextResponse<T> {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: expiresAt,
  });
  return response;
}

export function clearSessionCookie<T>(response: NextResponse<T>, secure: boolean): NextResponse<T> {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
  return response;
}
