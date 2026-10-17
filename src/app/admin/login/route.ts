import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin";

export const dynamic = "force-dynamic";

// GET /admin/login?key=<WORLD_ADMIN_KEY> sets the admin cookie for a year and opens the console. ?key=out signs out.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const given = url.searchParams.get("key") || "";
  const key = process.env.WORLD_ADMIN_KEY;
  if (given === "out") { const r = NextResponse.redirect(new URL("/", url)); r.cookies.delete(ADMIN_COOKIE); return r; }
  if (!key || given !== key) return NextResponse.json({ error: "Wrong key." }, { status: 401 });
  const r = NextResponse.redirect(new URL("/admin", url));
  r.cookies.set(ADMIN_COOKIE, key, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 365 * 24 * 3600 });
  return r;
}
