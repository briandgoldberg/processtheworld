import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { adminFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";

// Everyone who has joined: guests (no email) and email members. `low=1` lists only people running low on credits.
export async function GET(req: NextRequest) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  const kind = req.nextUrl.searchParams.get("kind");
  const low = req.nextUrl.searchParams.get("low") === "1";
  const where: any = kind === "email" ? { emailVerifiedAt: { not: null } } : kind === "guest" ? { emailVerifiedAt: null } : {};
  if (low) where.points = { lt: 21 };
  const rows = await prisma.user.findMany({
    where, orderBy: low ? { points: "asc" } : { lastSeenAt: "desc" }, take: 300,
    select: { handle: true, email: true, emailVerifiedAt: true, createdAt: true, lastSeenAt: true, points: true, _count: { select: { processes: true, published: true, turns: true } } },
  });
  return json({ members: rows.map(u => ({ handle: u.handle, email: u.emailVerifiedAt ? u.email : null, kind: u.emailVerifiedAt ? "email" : "guest", joined: u.createdAt, lastSeen: u.lastSeenAt, credits: Math.max(0, Math.floor(u.points)), processes: u._count.processes, published: u._count.published, turns: u._count.turns })) });
}
