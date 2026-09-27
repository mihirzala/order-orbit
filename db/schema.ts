import {
  boolean,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Addresses: shipping addresses. One may be flagged as default.
 * Buy approval is blocked until a default shipping address exists.
 */
export const addresses = pgTable("addresses", {
  id: uuid("id").defaultRandom().primaryKey(),
  label: text("label").notNull(), // e.g. "Home", "Work"
  fullName: text("full_name").notNull(),
  street: text("street").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zip: text("zip").notNull(),
  country: text("country").notNull().default("US"),
  phone: text("phone"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Retailer connections: one row per login-supported retailer (amazon | walmart | target).
 * Credentials are encrypted at rest (AES-256-GCM) before they reach this table.
 * Only masked usernames are ever displayed.
 */
export const retailerConnections = pgTable("retailer_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  retailer: text("retailer").notNull().unique(), // amazon | walmart | target | costco (deals only; no login yet)
  usernameEncrypted: text("username_encrypted").notNull(),
  passwordEncrypted: text("password_encrypted").notNull(),
  usernameMasked: text("username_masked").notNull(), // safe to display
  status: text("status").notNull().default("connected"), // connected | needs_relogin
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Deal searches: a saved search query + optional retailer filter.
 * The background worker fills pending searches.
 */
export const dealSearches = pgTable("deal_searches", {
  id: uuid("id").defaultRandom().primaryKey(),
  query: text("query").notNull(),
  retailer: text("retailer"), // null = all retailers (amazon | walmart | target | costco (deals only; no login yet))
  status: text("status").notNull().default("pending"), // pending | ready | needs_attention
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

/**
 * Deals: individual product listings attached to a search.
 * Only rows with availability='available' are shown in the UI.
 */
export const deals = pgTable("deals", {
  id: uuid("id").defaultRandom().primaryKey(),
  searchId: uuid("search_id").references(() => dealSearches.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  retailer: text("retailer").notNull(), // amazon | walmart | target | costco (deals only; no login yet)
  imageUrl: text("image_url"),
  productUrl: text("product_url").notNull(),
  availability: text("availability").notNull().default("available"), // available | sold_out | unknown
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Orders: created when the user taps Buy (explicit approval).
 * checkout_status pipeline: approved_for_checkout -> processing -> placed | needs_attention
 */
export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  retailer: text("retailer").notNull(),
  productUrl: text("product_url").notNull(),
  quantity: numeric("quantity", { precision: 6, scale: 0 }).notNull().default("1"),
  priceAtApproval: numeric("price_at_approval", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  addressId: uuid("address_id").references(() => addresses.id, {
    onDelete: "set null",
  }),
  checkoutStatus: text("checkout_status")
    .notNull()
    .default("approved_for_checkout"), // approved_for_checkout | processing | placed | needs_attention
  confirmationNumber: text("confirmation_number"),
  chargedTotal: numeric("charged_total", { precision: 12, scale: 2 }),
  failureReason: text("failure_reason"),
  attempts: numeric("attempts", { precision: 6, scale: 0 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Returns: requested against a placed order.
 * status pipeline: fetching -> ready | needs_attention
 * QR payloads only ever come from the retailer's own return flow.
 */
export const returns = pgTable("returns", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .references(() => orders.id, { onDelete: "cascade" })
    .notNull(),
  status: text("status").notNull().default("fetching"), // fetching | ready | needs_attention
  reason: text("reason").notNull().default(""),
  qrImageUrl: text("qr_image_url"), // retailer-issued QR image, when provided
  qrData: text("qr_data"), // retailer-issued QR payload, when provided
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Requests: manual / custom free-text item requests (secondary tab).
 */
export const requests = pgTable("requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  details: text("details"),
  status: text("status").notNull().default("pending"), // pending | done
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Address = typeof addresses.$inferSelect;
export type RetailerConnection = typeof retailerConnections.$inferSelect;
export type DealSearch = typeof dealSearches.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Return = typeof returns.$inferSelect;
export type Request = typeof requests.$inferSelect;
