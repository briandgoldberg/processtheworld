import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { adminFrom } from "@/lib/identity";
import { ownerIds } from "@/lib/excludeOwner";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  const ex = await ownerIds();
  const rows = await prisma.process.findMany({
    where: { userId: { notIn: ex } }, orderBy: { updatedAt: "desc" }, take: 100,
    select: { id: true, title: true, status: true, stepCount: true, depth: true, createdAt: true, updatedAt: true, user: { select: { handle: true, email: true } }, _count: { select: { turns: true, feedback: true } } },
  });
  const ids = rows.map(r => r.id);
  const corr = await prisma.turn.groupBy({ by: ["processId"], where: { processId: { in: ids }, feedbackType: "correction" }, _count: true });
  const cost = await prisma.aiCall.groupBy({ by: ["processId"], where: { processId: { in: ids } }, _sum: { costUsd: true } });
  const rating = await prisma.feedback.findMany({ where: { processId: { in: ids }, kind: "finish" }, select: { processId: true, rating: true }, orderBy: { createdAt: "desc" } });
  return json({ sessions: rows.map(r => ({
    id: r.id, title: r.title, status: r.status, steps: r.stepCount, layers: r.depth, created: r.createdAt, updated: r.updatedAt,
    who: r.user.email || r.user.handle, turns: r._count.turns, feedback: r._count.feedback,
    corrections: corr.find(c => c.processId === r.id)?._count || 0,
    cost: cost.find(c => c.processId === r.id)?._sum.costUsd || 0,
    rating: rating.find(x => x.processId === r.id)?.rating ?? null,
  })) });
}
