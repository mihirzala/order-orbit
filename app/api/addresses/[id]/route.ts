import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { addresses } from "@/db/schema";
import { getDb } from "@/lib/db";
import { badRequest, requireAuth } from "@/lib/api";

export const dynamic = "force-dynamic";

const PatchBody = z.object({ isDefault: z.boolean() });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const denied = await requireAuth();
  if (denied) return denied;
  const parsed = PatchBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest("Invalid request.");
  const db = getDb();
  if (parsed.data.isDefault) {
    await db.update(addresses).set({ isDefault: false });
  }
  const [row] = await db
    .update(addresses)
    .set({ isDefault: parsed.data.isDefault })
    .where(eq(addresses.id, params.id))
    .returning();
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ address: row });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const denied = await requireAuth();
  if (denied) return denied;
  const db = getDb();
  await db.delete(addresses).where(eq(addresses.id, params.id));
  return NextResponse.json({ ok: true });
}
