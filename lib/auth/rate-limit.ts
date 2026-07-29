const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

interface AttemptState {
  failures: number;
  resetAt: number;
}

const attempts = new Map<string, AttemptState>();

export function loginRateLimitKey(request: Request, email: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return `${ip}:${email}`;
}

export function checkLoginRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const state = attempts.get(key);
  if (!state || state.resetAt <= now) {
    if (state) attempts.delete(key);
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return {
    allowed: state.failures < MAX_FAILURES,
    retryAfterSeconds: Math.max(1, Math.ceil((state.resetAt - now) / 1000)),
  };
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const state = attempts.get(key);
  if (!state || state.resetAt <= now) {
    attempts.set(key, { failures: 1, resetAt: now + WINDOW_MS });
    return;
  }
  state.failures += 1;
}

export function clearLoginFailures(key: string): void {
  attempts.delete(key);
}
