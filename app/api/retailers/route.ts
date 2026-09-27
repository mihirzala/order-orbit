import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { retailerConnections } from "@/db/schema";
import { getDb } from "@/lib/db";
import { badRequest, requireAuth } from "@/lib/api";
import { encrypt, maskUsername } from "@/lib/crypto";
import { isSupportedRetailer } from "@/lib/checkout/driver";

export const dynamic = "force-dynamic";

const Body = z.object({
  retailer: z.string().min(1),
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(500),
});

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  const db = getDb();
  const rows = await db
    .select({
      id: retailerConnections.id,
      retailer: retailerConnections.retailer,
      usernameMasked: retailerConnections.usernameMasked,
      status: retailerConnections.status,
      lastCheckedAt: retailerConnections.lastCheckedAt,
    })
    .from(retailerConnections)
    .orderBy(desc(retailerConnections.createdAt));
  return NextResponse.json({ connections: rows });
}

export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest("Retailer, username, and password are required.");
  const { retailer, username, password } = parsed.data;
  if (!isSupportedRetailer(retailer)) {
    return badRequest("Only amazon, walmart, and target are supported.");
  }

  let usernameEncrypted: string;
  let passwordEncrypted: string;
  try {
    usernameEncrypted = encrypt(username);
    passwordEncrypted = encrypt(password);
  } catch {
    return NextResponse.json({ error: "Encryption is not configured." }, { status: 500 });
  }

  const db = getDb();
  // One connection per retailer: upsert.
  await db
    .insert(retailerConnections)
    .values({
      retailer,
      usernameEncrypted,
      passwordEncrypted,
      usernameMasked: maskUsername(username),
      status: "connected",
    })
    .onConflictDoUpdate({
      target: retailerConnections.retailer,
      set: {
        usernameEncrypted,
        passwordEncrypted,
        usernameMasked: maskUsername(username),
        status: "connected",
        updatedAt: new Date(),
      },
    });
  // Never return credential material.
  return NextResponse.json({ ok: true, retailer });
}
