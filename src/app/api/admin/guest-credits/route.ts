import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { adminFrom } from "@/lib/identity";
import { START_CREDITS } from "@/lib/points";

export const dynamic = "force-dynamic";

// Admin only: bring every guest (no confirmed email) down to the starting 10 credits. Guests already at 10 or fewer are left alone.
export async function POST(req: NextRequest) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  const r = await prisma.user.updateMany({ where: { emailVerifiedAt: null, points: { gt: START_CREDITS } }, data: { points: START_CREDITS } });
  return json({ ok: true, changed: r.count });
}
