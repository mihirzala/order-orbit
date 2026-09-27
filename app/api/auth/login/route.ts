import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { badRequest } from "@/lib/api";

export const dynamic = "force-dynamic";

const Body = z.object({ password: z.string().min(1) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest("Password is required.");

  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }
  const a = Buffer.from(parsed.data.password);
  const b = Buffer.from(expected);
  const match = a.length === b.length && timingSafeEqual(a, b);
  if (!match) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  await createSession();
  return NextResponse.json({ ok: true });
}
