const required = ["DATABASE_URL"] as const;

function loadEnv(): Record<(typeof required)[number], string> {
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    DATABASE_URL: process.env.DATABASE_URL!,
  };
}

let _env: ReturnType<typeof loadEnv> | null = null;

export function getEnv() {
  if (!_env) {
    _env = loadEnv();
  }
  return _env;
}
