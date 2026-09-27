import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { orders, returns } from "@/db/schema";
import { getDb } from "@/lib/db";
import { badRequest, requireAuth } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  const db = getDb();
  const rows = await db
    .select({
      id: returns.id,
      orderId: returns.orderId,
      status: returns.status,
      reason: returns.reason,
      qrImageUrl: returns.qrImageUrl,
      qrData: returns.qrData,
      failureReason: returns.failureReason,
      createdAt: returns.createdAt,
      orderTitle: orders.title,
    })
    .from(returns)
    .innerJoin(orders, eq(returns.orderId, orders.id))
    .orderBy(desc(returns.createdAt))
    .limit(100);
  return NextResponse.json({ returns: rows });
}

const ReturnBody = z.object({ orderId: z.string().uuid("Invalid order.") });

/** Request a return on a placed order. The worker fetches the retailer QR code. */
export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const parsed = ReturnBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest("Invalid return request.");

  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, parsed.data.orderId)).limit(1);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.checkoutStatus !== "placed") {
    return NextResponse.json(
      { error: "Returns can only be requested on orders that were placed." },
      { status: 409 },
    );
  }
  const [existing] = await db
    .select()
    .from(returns)
    .where(eq(returns.orderId, order.id))
    .limit(1);
  if (existing) {
    return NextResponse.json({ return: existing });
  }

  const [row] = await db
    .insert(returns)
    .values({
      orderId: order.id,
      status: "fetching",
      reason: "Return requested. Waiting for the retailer to issue a return code.",
    })
    .returning();
  return NextResponse.json({ return: row }, { status: 201 });
}
