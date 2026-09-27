import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "ors_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecretKey(): Uint8Array {
  const pw = process.env.APP_PASSWORD;
  if (!pw) {
    throw new Error("APP_PASSWORD is not set");
  }
  return new TextEncoder().encode(`ors-session:${pw}`);
}

/** Create a signed session cookie after a successful password login. */
export async function createSession(): Promise<void> {
  const key = getSecretKey();
  const token = await new SignJWT({ sub: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(key);
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Destroy the session cookie. */
export function destroySession(): void {
  cookies().set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Verify the session cookie; returns true when the visitor is signed in. */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const token = cookies().get(COOKIE_NAME)?.value;
    if (!token) return false;
    await jwtVerify(token, getSecretKey());
    return true;
  } catch {
    return false;
  }
}

/** Verify a raw Authorization bearer token (used by the cron route). */
export async function verifyBearerToken(header: string | null): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return false;
  // Constant-time comparison to avoid timing leaks.
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  const { timingSafeEqual } = await import("node:crypto");
  return timingSafeEqual(a, b);
}
