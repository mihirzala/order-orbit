/**
 * Checkout driver abstraction.
 *
 * Each supported retailer gets a driver class implementing `CheckoutDriver`.
 * Drivers attempt a REAL checkout and honestly report the outcome — they must
 * NEVER fabricate a confirmation number or a charged total. When checkout is
 * impossible from this environment (bot detection, login challenge, missing
 * payment method, ...), the driver returns { ok: false } with a plain-language
 * reason that is shown to the user in the Orders tab.
 */

export type RetailerName = "amazon" | "walmart" | "target";

/** Retailers with login + checkout driver support. */
export const SUPPORTED_RETAILERS: RetailerName[] = ["amazon", "walmart", "target"];

/**
 * Every retailer the app lists and filters by. Costco is listed for deals,
 * but login/checkout support is not enabled for it yet.
 */
export const ALL_RETAILERS: string[] = ["amazon", "walmart", "target", "costco"];

export function isSupportedRetailer(value: string): value is RetailerName {
  return (SUPPORTED_RETAILERS as string[]).includes(value);
}

export function isKnownRetailer(value: string): boolean {
  return ALL_RETAILERS.includes(value);
}

export interface CheckoutCredentials {
  username: string;
  password: string;
}

export interface ShippingAddress {
  fullName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string | null;
}

export interface CheckoutContext {
  retailer: RetailerName;
  orderId: string;
  title: string;
  productUrl: string;
  quantity: number;
  priceAtApproval: number;
  credentials: CheckoutCredentials;
  address: ShippingAddress;
  userAgent: string;
}

export type CheckoutSuccess = {
  ok: true;
  /** Retailer-issued order / confirmation number. */
  confirmationNumber: string;
  /** Total actually charged, in USD. */
  chargedTotal: number;
};

export type CheckoutFailure = {
  ok: false;
  /**
   * Plain-language reason shown in the app, e.g.
   * "Amazon asked for a one-time code — sign in once in your browser, then retry."
   */
  reason: string;
  /** Machine-readable category for future retry logic. */
  category:
    | "missing_credentials"
    | "missing_address"
    | "login_challenge"
    | "bot_blocked"
    | "item_unavailable"
    | "no_payment_method"
    | "timeout"
    | "unsupported_environment"
    | "unknown";
};

export type CheckoutResult = CheckoutSuccess | CheckoutFailure;

export type ReturnQrSuccess = {
  ok: true;
  /** Retailer-issued QR image URL (hosted by the retailer). */
  qrImageUrl?: string;
  /** Retailer-issued QR payload data. */
  qrData?: string;
};

export type ReturnQrFailure = {
  ok: false;
  reason: string;
  category: CheckoutFailure["category"];
};

export type ReturnQrResult = ReturnQrSuccess | ReturnQrFailure;

export interface CheckoutDriver {
  readonly retailer: RetailerName;
  attemptCheckout(ctx: CheckoutContext): Promise<CheckoutResult>;
  fetchReturnQr(ctx: CheckoutContext): Promise<ReturnQrResult>;
}

/** Shared preflight checks every driver runs before attempting anything. */
function preflight(ctx: CheckoutContext): CheckoutFailure | null {
  if (!ctx.credentials.username || !ctx.credentials.password) {
    return {
      ok: false,
      category: "missing_credentials",
      reason: `No saved ${ctx.retailer} login found. Add it in the Retailers tab first.`,
    };
  }
  if (!ctx.address || !ctx.address.street || !ctx.address.zip) {
    return {
      ok: false,
      category: "missing_address",
      reason:
        "No shipping address on file. Add a default address in the Addresses tab before approving a purchase.",
    };
  }
  if (!ctx.productUrl) {
    return {
      ok: false,
      category: "item_unavailable",
      reason: "The product link is missing, so checkout cannot continue.",
    };
  }
  return null;
}

/**
 * Why headless checkout cannot run on free serverless hosting.
 * This is the honest outcome for all three retailers until a dedicated
 * browser-automation worker (outside Vercel Hobby) is attached. See README.
 */
function serverlessBlocked(ctx: CheckoutContext, action: "checkout" | "return QR"): CheckoutFailure {
  const retailerLabel = ctx.retailer[0].toUpperCase() + ctx.retailer.slice(1);
  return {
    ok: false,
    category: "unsupported_environment",
    reason:
      `${retailerLabel} ${action} needs a real browser session, and Vercel's free serverless ` +
      `functions cannot run one (10s limits, datacenter IPs are bot-blocked). ` +
      `Nothing was charged. Finish this one in your browser: ${ctx.productUrl}`,
  };
}

class BaseRetailDriver implements CheckoutDriver {
  readonly retailer: RetailerName;
  constructor(retailer: RetailerName) {
    this.retailer = retailer;
  }

  async attemptCheckout(ctx: CheckoutContext): Promise<CheckoutResult> {
    const blocked = preflight(ctx);
    if (blocked) return blocked;
    // Extension point: a future browser-automation worker would be invoked
    // here with ctx.credentials (never logged) and ctx.address. Until then,
    // report honestly instead of pretending a purchase happened.
    return serverlessBlocked(ctx, "checkout");
  }

  async fetchReturnQr(ctx: CheckoutContext): Promise<ReturnQrResult> {
    const blocked = preflight(ctx);
    if (blocked) return { ok: false, reason: blocked.reason, category: blocked.category };
    // QR codes must be issued by the retailer's own return flow; this app
    // cannot mint them. Same browser-session limitation applies.
    const r = serverlessBlocked(ctx, "return QR");
    return { ok: false, reason: r.reason, category: r.category };
  }
}

export class AmazonDriver extends BaseRetailDriver {
  constructor() {
    super("amazon");
  }
}

export class WalmartDriver extends BaseRetailDriver {
  constructor() {
    super("walmart");
  }
}

export class TargetDriver extends BaseRetailDriver {
  constructor() {
    super("target");
  }
}

export function getDriver(retailer: string): CheckoutDriver {
  switch (retailer) {
    case "amazon":
      return new AmazonDriver();
    case "walmart":
      return new WalmartDriver();
    case "target":
      return new TargetDriver();
    default:
      throw new Error(`Unsupported retailer: ${retailer}`);
  }
}
