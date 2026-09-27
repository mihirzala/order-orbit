import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requests } from "@/db/schema";
import { getDb } from "@/lib/db";
import { badRequest, requireAuth } from "@/lib/api";

export const dynamic = "force-dynamic";

const PatchBody = z.object({ status: z.enum(["pending", "done"]) });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const denied = await requireAuth();
  if (denied) return denied;
  const parsed = PatchBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest("Invalid status.");
  const db = getDb();
  const [row] = await db
    .update(requests)
    .set({ status: parsed.data.status })
    .where(eq(requests.id, params.id))
    .returning();
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ request: row });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const denied = await requireAuth();
  if (denied) return denied;
  const db = getDb();
  await db.delete(requests).where(eq(requests.id, params.id));
  return NextResponse.json({ ok: true });
}
