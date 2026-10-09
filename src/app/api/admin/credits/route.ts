import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { adminFrom } from "@/lib/identity";
import { LOW_CREDITS } from "@/lib/points";

export const dynamic = "force-dynamic";

// People who are low on credits or paused, lowest first.
export async function GET(req: NextRequest) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  const rows = await prisma.user.findMany({
    where: { points: { lte: LOW_CREDITS } }, orderBy: { points: "asc" }, take: 200,
    select: { handle: true, email: true, emailVerifiedAt: true, points: true, lastSeenAt: true },
  });
  return json({
    lowAtOrBelowUsd: LOW_CREDITS / 100,
    users: rows.map(u => ({ handle: u.handle, email: u.emailVerifiedAt ? u.email : null, leftUsd: Math.max(0, u.points) / 100, paused: u.points <= 0, lastSeenAt: u.lastSeenAt })),
  });
}
