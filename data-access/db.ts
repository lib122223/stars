import { Pool, type QueryResultRow } from "pg";
import { getEnv } from "@/lib/env";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getEnv().DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const client = getPool();
  const result = await client.query<T>(text, params);
  return result.rows;
}

export async function getClient() {
  const client = await getPool().connect();
  return client;
}
