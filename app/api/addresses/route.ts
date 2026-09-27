import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { addresses } from "@/db/schema";
import { getDb } from "@/lib/db";
import { badRequest, requireAuth } from "@/lib/api";

export const dynamic = "force-dynamic";

const AddressBody = z.object({
  label: z.string().min(1).max(60),
  fullName: z.string().min(1).max(120),
  street: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(60),
  zip: z.string().min(1).max(20),
  country: z.string().min(1).max(60).default("US"),
  phone: z.string().max(40).nullable().optional(),
});

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  const db = getDb();
  const rows = await db.select().from(addresses).orderBy(desc(addresses.createdAt));
  return NextResponse.json({ addresses: rows });
}

export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const parsed = AddressBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest("All address fields are required.");
  const db = getDb();
  const existing = await db.select().from(addresses).limit(1);
  // The first address becomes the default automatically.
  const [row] = await db
    .insert(addresses)
    .values({ ...parsed.data, phone: parsed.data.phone ?? null, isDefault: existing.length === 0 })
    .returning();
  return NextResponse.json({ address: row }, { status: 201 });
}
