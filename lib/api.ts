import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

/** API routes are behind middleware too; this is defense-in-depth. */
export async function requireAuth(): Promise<NextResponse | null> {
  if (await isAuthenticated()) return null;
  return NextResponse.json({ error: "Not signed in." }, { status: 401 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}
