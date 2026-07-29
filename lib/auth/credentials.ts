import { hash, verify } from "@node-rs/argon2";

const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

export function passwordValidationError(value: unknown): string | null {
  if (typeof value !== "string" || value.length < PASSWORD_MIN_LENGTH) {
    return `密码至少需要 ${PASSWORD_MIN_LENGTH} 个字符`;
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return `密码不能超过 ${PASSWORD_MAX_LENGTH} 个字符`;
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    algorithm: 2,
    memoryCost: 19 * 1024,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
