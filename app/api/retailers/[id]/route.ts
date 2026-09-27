import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { retailerConnections } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const denied = await requireAuth();
  if (denied) return denied;
  const db = getDb();
  await db.delete(retailerConnections).where(eq(retailerConnections.id, params.id));
  return NextResponse.json({ ok: true });
}
