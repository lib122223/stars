import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const OBSERVER_COOKIE = "echo_observer_id";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ObserverIdentity {
  id: string;
  shouldSetCookie: boolean;
}

export async function getObserverIdentity(): Promise<ObserverIdentity> {
  const existing = (await cookies()).get(OBSERVER_COOKIE)?.value;
  if (existing && UUID_PATTERN.test(existing)) return { id: existing, shouldSetCookie: false };
  return { id: randomUUID(), shouldSetCookie: true };
}

export function attachObserverCookie<T>(
  response: NextResponse<T>,
  observer: ObserverIdentity,
  secure: boolean,
): NextResponse<T> {
  if (observer.shouldSetCookie) {
    response.cookies.set({
      name: OBSERVER_COOKIE,
      value: observer.id,
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
  }
  return response;
}
