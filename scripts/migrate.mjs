import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const schemaPath = fileURLToPath(new URL("../data-access/schema.sql", import.meta.url));
const schema = await readFile(schemaPath, "utf8");
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  await client.query(schema);
  await client.query("COMMIT");
  console.log("Database schema is up to date.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
