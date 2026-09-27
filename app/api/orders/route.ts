import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { addresses, deals, orders } from "@/db/schema";
import { getDb } from "@/lib/db";
import { badRequest, requireAuth } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  const db = getDb();
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(100);
  return NextResponse.json({ orders: rows });
}

const BuyBody = z.object({
  dealId: z.string().uuid("Invalid deal."),
  quantity: z.number().int().min(1).max(99).default(1),
});

/**
 * Buy: the user's explicit purchase approval.
 * Creates an order with checkout_status = approved_for_checkout.
 * The background worker (POST /api/cron/process) performs checkout later.
 * Nothing is charged by this endpoint.
 */
export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const parsed = BuyBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest("Invalid order request.");

  const db = getDb();
  const [deal] = await db.select().from(deals).where(eq(deals.id, parsed.data.dealId)).limit(1);
  if (!deal || deal.availability !== "available") {
    return NextResponse.json({ error: "That deal is no longer available." }, { status: 409 });
  }

  const [address] = await db
    .select()
    .from(addresses)
    .where(eq(addresses.isDefault, true))
    .limit(1);
  if (!address) {
    return NextResponse.json(
      { error: "Add a default shipping address in the Addresses tab before buying." },
      { status: 409 },
    );
  }

  const [order] = await db
    .insert(orders)
    .values({
      dealId: deal.id,
      title: deal.title,
      retailer: deal.retailer,
      productUrl: deal.productUrl,
      quantity: String(parsed.data.quantity),
      priceAtApproval: deal.price,
      currency: deal.currency,
      addressId: address.id,
      checkoutStatus: "approved_for_checkout",
    })
    .returning();

  return NextResponse.json({ order }, { status: 201 });
}
