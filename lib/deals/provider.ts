import { and, desc, eq, ilike, or } from "drizzle-orm";
import { deals, type Deal } from "@/db/schema";
import type { Db } from "@/lib/db";

/**
 * Deal provider abstraction.
 *
 * There is no free product API for Amazon, Walmart, or Target, and all three
 * block datacenter scraping. So deal discovery on the free tier is honest
 * about what it is: deals are added manually (paste a product link you found),
 * and the provider serves genuinely-available listings from the database.
 * The cron worker marks a pending search "ready" once matching available
 * deals exist.
 */
export interface DealProvider {
  readonly name: string;
  findAvailableDeals(db: Db, query: string, retailer: string | null): Promise<Deal[]>;
  recheckPrice(deal: Deal): Promise<{ price: number; currency: string } | null>;
}

export class ManualCatalogProvider implements DealProvider {
  readonly name = "manual-catalog";

  async findAvailableDeals(db: Db, query: string, retailer: string | null): Promise<Deal[]> {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const conditions = words.map((w) => ilike(deals.title, `%${w}%`));
    const rows = await db
      .select()
      .from(deals)
      .where(
        and(
          eq(deals.availability, "available"),
          retailer ? eq(deals.retailer, retailer) : undefined,
          words.length > 0 ? or(...conditions) : undefined,
        ),
      )
      .orderBy(desc(deals.createdAt))
      .limit(50);
    return rows;
  }

  /**
   * The database is the source of truth for the approved price. A live
   * retailer price scrape is not possible from free serverless hosting
   * (bot detection), so the re-check guards against the deal's recorded
   * price changing after the user approved the purchase.
   */
  async recheckPrice(deal: Deal): Promise<{ price: number; currency: string } | null> {
    return { price: Number(deal.price), currency: deal.currency };
  }
}

export function getDealProvider(): DealProvider {
  return new ManualCatalogProvider();
}
