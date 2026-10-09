import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { REWARDS } from "@/lib/points";

export const dynamic = "force-dynamic";

// Your balance and what earned or spent it recently.
export async function GET(req: NextRequest) {
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const recent = await prisma.pointEvent.findMany({ where: { userId: user.id, reason: { not: "ai" } }, orderBy: { createdAt: "desc" }, take: 8, select: { delta: true, reason: true, createdAt: true } });
  const spent = await prisma.pointEvent.aggregate({ where: { userId: user.id, reason: "ai" }, _sum: { delta: true } });
  return json({
    points: user.points,
    spent: -(spent._sum.delta || 0),
    recent: recent.map(e => ({ delta: e.delta, label: (REWARDS as any)[e.reason]?.label || e.reason, at: e.createdAt })),
    ways: Object.values(REWARDS).map(r => ({ points: r.points, label: r.label })),
  });
}
