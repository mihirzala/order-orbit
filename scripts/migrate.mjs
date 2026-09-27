/**
 * Applies drizzle migrations to the database.
 * Usage: DATABASE_URL=... npm run db:migrate
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "drizzle");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(url);

// Minimal journal-based runner (mirrors drizzle-kit journal layout).
const journal = JSON.parse(readFileSync(join(migrationsDir, "meta", "_journal.json"), "utf8"));
for (const entry of journal.entries) {
  const file = join(migrationsDir, `${entry.tag}.sql`);
  const statements = readFileSync(file, "utf8");
  console.log(`Applying ${entry.tag}...`);
  // Split on statement-breakpoint markers drizzle-kit emits.
  for (const chunk of statements.split("--> statement-breakpoint")) {
    const trimmed = chunk.trim();
    if (trimmed) await sql(trimmed);
  }
  await sql`
    INSERT INTO "__drizzle_migrations" ("hash", "created_at")
    VALUES (${entry.tag}, ${Date.now()})
    ON CONFLICT DO NOTHING
  `.catch(async () => {
    await sql`CREATE TABLE IF NOT EXISTS "__drizzle_migrations" ("id" SERIAL PRIMARY KEY, "hash" TEXT NOT NULL, "created_at" BIGINT)`;
    await sql`INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (${entry.tag}, ${Date.now()}) ON CONFLICT DO NOTHING`;
  });
}
console.log("Migrations applied.");
