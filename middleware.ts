import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "ors_session";

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(`ors-session:${process.env.APP_PASSWORD ?? ""}`);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public: login page and the cron worker (guarded by CRON_SECRET bearer token).
  if (pathname === "/login" || pathname === "/api/cron/process") {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token && process.env.APP_PASSWORD) {
    try {
      await jwtVerify(token, getSecretKey());
      return NextResponse.next();
    } catch {
      // fall through to login redirect
    }
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
