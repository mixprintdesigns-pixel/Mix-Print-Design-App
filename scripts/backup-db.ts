// Saves every table to backups/<date-time>.json before any data change: `npm run db:backup`.
// Uses DATABASE_URL (or the Vercel/Neon variables). The file contains customer data and password
// hashes, so the backups/ folder is git-ignored: keep the file private.
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { Client } from "pg";
import { resolveDatabaseUrl } from "../src/lib/database-url";

async function main() {
  const client = new Client({ connectionString: resolveDatabaseUrl() });
  await client.connect();
  const { rows: tables } = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  const data: Record<string, unknown[]> = {};
  for (const { tablename } of tables) data[tablename] = (await client.query(`SELECT * FROM "public"."${tablename}"`)).rows;
  await client.end();

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  mkdirSync("backups", { recursive: true });
  const file = `backups/${stamp}.json`;
  writeFileSync(file, JSON.stringify({ createdAt: new Date().toISOString(), tables: data }, null, 1));
  console.log(`Backup saved: ${file}`);
  for (const [t, r] of Object.entries(data)) console.log(`  ${t}: ${r.length} rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
