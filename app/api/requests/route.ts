import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { requests } from "@/db/schema";
import { getDb } from "@/lib/db";
import { badRequest, requireAuth } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  const db = getDb();
  const rows = await db.select().from(requests).orderBy(desc(requests.createdAt)).limit(100);
  return NextResponse.json({ requests: rows });
}

const RequestBody = z.object({
  title: z.string().min(1).max(300),
  details: z.string().max(2000).nullable().optional(),
});

export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const parsed = RequestBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest("A title is required.");
  const db = getDb();
  const [row] = await db
    .insert(requests)
    .values({ title: parsed.data.title, details: parsed.data.details ?? null })
    .returning();
  return NextResponse.json({ request: row }, { status: 201 });
}
