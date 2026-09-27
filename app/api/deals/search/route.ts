import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { dealSearches } from "@/db/schema";
import { getDb } from "@/lib/db";
import { badRequest, requireAuth } from "@/lib/api";
import { getDealProvider } from "@/lib/deals/provider";
import { isKnownRetailer } from "@/lib/checkout/driver";

export const dynamic = "force-dynamic";

const SearchBody = z.object({
  query: z.string().min(1).max(200),
  retailer: z.string().nullable().optional(),
});

/**
 * Save a deal search and return matching available deals right away.
 * The background worker re-checks pending searches on its schedule.
 */
export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const parsed = SearchBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest("A search query is required.");
  const { query, retailer } = parsed.data;
  if (retailer && !isKnownRetailer(retailer)) {
    return badRequest("Only amazon, walmart, and target are supported.");
  }

  const db = getDb();
  const [search] = await db
    .insert(dealSearches)
    .values({ query, retailer: retailer ?? null, status: "pending" })
    .returning();

  const provider = getDealProvider();
  const matches = await provider.findAvailableDeals(db, query, retailer ?? null);

  let searchStatus = "pending";
  if (matches.length > 0) {
    searchStatus = "ready";
    await db
      .update(dealSearches)
      .set({
        status: "ready",
        note: `${matches.length} available deal(s) found`,
        completedAt: new Date(),
      })
      .where(eq(dealSearches.id, search.id));
  }

  return NextResponse.json({ deals: matches, searchId: search.id, searchStatus });
}
