import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
  addresses,
  dealSearches,
  deals,
  orders,
  retailerConnections,
  returns,
  type Order,
  type Return,
} from "@/db/schema";
import { getDb, type Db } from "@/lib/db";
import { verifyBearerToken } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { getDriver, type CheckoutContext } from "@/lib/checkout/driver";
import { getDealProvider } from "@/lib/deals/provider";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // ask for the longest free-tier window; still capped by the plan

const PRICE_TOLERANCE = 0.1; // 10%
const USER_AGENT = "OrderingReturns/1.0 (+background-checkout-worker)";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

async function fillPendingSearches(db: Db): Promise<number> {
  const pending = await db
    .select()
    .from(dealSearches)
    .where(eq(dealSearches.status, "pending"))
    .limit(25);
  const provider = getDealProvider();
  let filled = 0;
  for (const s of pending) {
    const matches = await provider.findAvailableDeals(db, s.query, s.retailer);
    if (matches.length > 0) {
      await db
        .update(dealSearches)
        .set({
          status: "ready",
          note: `${matches.length} available deal(s) found`,
          completedAt: new Date(),
        })
        .where(eq(dealSearches.id, s.id));
      filled += 1;
    }
  }
  return filled;
}

async function buildCheckoutContext(
  db: Db,
  order: Order,
): Promise<{ ctx: CheckoutContext } | { error: string; category: "missing_credentials" | "missing_address" }> {
  const [conn] = await db
    .select()
    .from(retailerConnections)
    .where(eq(retailerConnections.retailer, order.retailer))
    .limit(1);
  if (!conn) {
    if (order.retailer === "costco") {
      return {
        error:
          "Costco checkout isn't available yet — logins aren't supported for Costco right now. Nothing was charged.",
        category: "missing_credentials",
      };
    }
    return {
      error: `No saved ${order.retailer} login. Add it in the Retailers tab, then this order can be retried.`,
      category: "missing_credentials",
    };
  }
  let username: string;
  let password: string;
  try {
    username = decrypt(conn.usernameEncrypted);
    password = decrypt(conn.passwordEncrypted);
  } catch {
    return {
      error: `Could not decrypt the saved ${order.retailer} login. Re-enter it in the Retailers tab.`,
      category: "missing_credentials",
    };
  }

  const [addr] = await db
    .select()
    .from(addresses)
    .where(eq(addresses.id, order.addressId ?? ""))
    .limit(1);
  const [fallback] = await db
    .select()
    .from(addresses)
    .where(eq(addresses.isDefault, true))
    .limit(1);
  const address = addr ?? fallback;
  if (!address) {
    return {
      error: "No shipping address on file. Add a default address in the Addresses tab.",
      category: "missing_address",
    };
  }

  return {
    ctx: {
      retailer: order.retailer as CheckoutContext["retailer"],
      orderId: order.id,
      title: order.title,
      productUrl: order.productUrl,
      quantity: Number(order.quantity),
      priceAtApproval: Number(order.priceAtApproval),
      credentials: { username, password }, // in memory only, never logged
      address: {
        fullName: address.fullName,
        street: address.street,
        city: address.city,
        state: address.state,
        zip: address.zip,
        country: address.country,
        phone: address.phone,
      },
      userAgent: USER_AGENT,
    },
  };
}

async function processOrder(db: Db, order: Order): Promise<string> {
  const attempts = Number(order.attempts) + 1;
  await db
    .update(orders)
    .set({ checkoutStatus: "processing", attempts: String(attempts), updatedAt: new Date() })
    .where(eq(orders.id, order.id));

  // 1. Price re-check: if the deal's recorded price moved more than 10%
  //    since approval, stop and flag — never charge on a changed price.
  if (order.dealId) {
    const [deal] = await db.select().from(deals).where(eq(deals.id, order.dealId)).limit(1);
    if (deal) {
      if (deal.availability !== "available") {
        await db
          .update(orders)
          .set({
            checkoutStatus: "needs_attention",
            failureReason: "The item is no longer listed as available. Nothing was charged.",
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));
        return "unavailable";
      }
      const recheck = await getDealProvider().recheckPrice(deal);
      if (recheck) {
        const approved = Number(order.priceAtApproval);
        const now = recheck.price;
        if (approved > 0 && Math.abs(now - approved) / approved > PRICE_TOLERANCE) {
          await db
            .update(orders)
            .set({
              checkoutStatus: "needs_attention",
              failureReason: `Price changed from ${fmt(approved)} to ${fmt(now)} (more than 10%). Nothing was charged. Re-approve at the new price if you still want it.`,
              updatedAt: new Date(),
            })
            .where(eq(orders.id, order.id));
          return "price_changed";
        }
      }
    }
  }

  // 2. Build the checkout context (credentials + address).
  const built = await buildCheckoutContext(db, order);
  if ("error" in built) {
    await db
      .update(orders)
      .set({
        checkoutStatus: "needs_attention",
        failureReason: built.error,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));
    return built.category;
  }

  // 3. Attempt checkout via the retailer driver.
  const driver = getDriver(order.retailer);
  const result = await driver.attemptCheckout(built.ctx);
  if (result.ok) {
    await db
      .update(orders)
      .set({
        checkoutStatus: "placed",
        confirmationNumber: result.confirmationNumber,
        chargedTotal: String(result.chargedTotal),
        failureReason: null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));
    return "placed";
  }

  await db
    .update(orders)
    .set({
      checkoutStatus: "needs_attention",
      failureReason: result.reason,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));
  return result.category;
}

async function processReturn(db: Db, ret: Return): Promise<string> {
  const [order] = await db.select().from(orders).where(eq(orders.id, ret.orderId)).limit(1);
  if (!order || order.checkoutStatus !== "placed") {
    await db
      .update(returns)
      .set({
        status: "needs_attention",
        failureReason: "The order is no longer in a placed state.",
        updatedAt: new Date(),
      })
      .where(eq(returns.id, ret.id));
    return "invalid_order";
  }

  const built = await buildCheckoutContext(db, order);
  if ("error" in built) {
    await db
      .update(returns)
      .set({ status: "needs_attention", failureReason: built.error, updatedAt: new Date() })
      .where(eq(returns.id, ret.id));
    return built.category;
  }

  const driver = getDriver(order.retailer);
  const result = await driver.fetchReturnQr(built.ctx);
  if (result.ok) {
    await db
      .update(returns)
      .set({
        status: "ready",
        reason: "The retailer issued a return code.",
        qrImageUrl: result.qrImageUrl ?? null,
        qrData: result.qrData ?? null,
        failureReason: null,
        updatedAt: new Date(),
      })
      .where(eq(returns.id, ret.id));
    return "ready";
  }

  await db
    .update(returns)
    .set({ status: "needs_attention", failureReason: result.reason, updatedAt: new Date() })
    .where(eq(returns.id, ret.id));
  return result.category;
}

/**
 * Background worker. Called every 5 minutes by the GitHub Actions cron.
 * Guarded by the CRON_SECRET bearer token (NOT the app login).
 */
export async function POST(req: Request) {
  const authorized = await verifyBearerToken(req.headers.get("authorization"));
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = getDb();
  const summary: Record<string, number | string> = {};

  try {
    summary.searchesFilled = await fillPendingSearches(db);

    const approved = await db
      .select()
      .from(orders)
      .where(eq(orders.checkoutStatus, "approved_for_checkout"))
      .limit(10);
    summary.ordersSeen = approved.length;
    const orderOutcomes: Record<string, number> = {};
    for (const o of approved) {
      const outcome = await processOrder(db, o);
      orderOutcomes[outcome] = (orderOutcomes[outcome] ?? 0) + 1;
    }
    summary.orderOutcomes = JSON.stringify(orderOutcomes);

    const fetching = await db
      .select()
      .from(returns)
      .where(eq(returns.status, "fetching"))
      .limit(10);
    summary.returnsSeen = fetching.length;
    const returnOutcomes: Record<string, number> = {};
    for (const r of fetching) {
      const outcome = await processReturn(db, r);
      returnOutcomes[outcome] = (returnOutcomes[outcome] ?? 0) + 1;
    }
    summary.returnOutcomes = JSON.stringify(returnOutcomes);
  } catch (err) {
    console.error("cron/process failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Worker failed partway.", summary }, { status: 500 });
  }

  return NextResponse.json({ ok: true, summary });
}
