import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@/db/schema";

let cached: ReturnType<typeof drizzle> | null = null;

/**
 * Lazily-created Drizzle client over Neon's HTTP driver.
 * Lazy so `next build` (which has no DATABASE_URL) never connects at build time.
 */
export function getDb() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const sql = neon(url);
  cached = drizzle(sql, { schema });
  return cached;
}

export type Db = ReturnType<typeof getDb>;
