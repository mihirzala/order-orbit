import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { deals } from "@/db/schema";
import { getDb } from "@/lib/db";
import { badRequest, requireAuth } from "@/lib/api";
import { isSupportedRetailer } from "@/lib/checkout/driver";

export const dynamic = "force-dynamic";

/** List genuinely available deals (sold-out / unknown are hidden). */
export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  const db = getDb();
  const rows = await db
    .select()
    .from(deals)
    .where(eq(deals.availability, "available"))
    .orderBy(desc(deals.createdAt))
    .limit(100);
  return NextResponse.json({ deals: rows });
}

const DealBody = z.object({
  title: z.string().min(1).max(300),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Price must be a number like 19.99"),
  retailer: z.string().min(1),
  productUrl: z.string().url("Product URL must be a valid URL"),
  imageUrl: z.string().url().nullable().optional(),
});

/** Manually add a deal (paste a product you found). */
export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const parsed = DealBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid deal.");
  }
  if (!isSupportedRetailer(parsed.data.retailer)) {
    return badRequest("Only amazon, walmart, and target are supported.");
  }
  const db = getDb();
  const [row] = await db
    .insert(deals)
    .values({
      title: parsed.data.title,
      price: parsed.data.price,
      currency: "USD",
      retailer: parsed.data.retailer,
      productUrl: parsed.data.productUrl,
      imageUrl: parsed.data.imageUrl ?? null,
      availability: "available",
    })
    .returning();
  return NextResponse.json({ deal: row }, { status: 201 });
}
