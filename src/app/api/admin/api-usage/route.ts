import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { adminFrom } from "@/lib/identity";
import { ownerIds } from "@/lib/excludeOwner";

export const dynamic = "force-dynamic";

// What the Anthropic API costs: every model call the site makes, priced from its own token counts.
// Unlike the rest of the dashboard this counts everyone, you included, because it is all one bill.
export async function GET(req: NextRequest) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get("days")) || 30));
  const now = new Date(), since = new Date(now.getTime() - days * 864e5);
  const dayAgo = new Date(now.getTime() - 864e5), weekAgo = new Date(now.getTime() - 7 * 864e5);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const ex = await ownerIds();
  const sum = (where: any) => prisma.aiCall.aggregate({ where, _sum: { costUsd: true, inputTokens: true, outputTokens: true, cacheRead: true, cacheWrite: true }, _count: true });
  const [today, week, month, period, mine, errors, billing, byMode, byModel, daily, top] = await Promise.all([
    sum({ createdAt: { gte: dayAgo } }),
    sum({ createdAt: { gte: weekAgo } }),
    sum({ createdAt: { gte: monthStart } }),
    sum({ createdAt: { gte: since } }),
    sum({ createdAt: { gte: since }, userId: { in: ex } }),
    prisma.aiCall.count({ where: { createdAt: { gte: since }, error: { not: null } } }),
    prisma.aiCall.findFirst({ where: { error: "ai_billing" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.aiCall.groupBy({ by: ["mode"], where: { createdAt: { gte: since } }, _sum: { costUsd: true }, _count: true }),
    prisma.aiCall.groupBy({ by: ["model"], where: { createdAt: { gte: since } }, _sum: { costUsd: true }, _count: true }),
    prisma.$queryRaw<{ day: Date; cost: number; calls: bigint }[]>`SELECT date_trunc('day', "createdAt") AS day, coalesce(sum("costUsd"), 0)::float AS cost, count(*)::bigint AS calls FROM "AiCall" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
    prisma.aiCall.groupBy({ by: ["userId"], where: { createdAt: { gte: since } }, _sum: { costUsd: true }, _count: true, orderBy: { _sum: { costUsd: "desc" } }, take: 10 }),
  ]);
  const users = await prisma.user.findMany({ where: { id: { in: top.map(t => t.userId).filter((x): x is string => !!x) } }, select: { id: true, handle: true, email: true } });
  const tot = (a: Awaited<ReturnType<typeof sum>>) => ({
    cost: a._sum.costUsd || 0, calls: a._count,
    input: (a._sum.inputTokens || 0) + (a._sum.cacheRead || 0) + (a._sum.cacheWrite || 0), output: a._sum.outputTokens || 0,
  });
  const group = (rows: { _sum: { costUsd: number | null }; _count: number }[], name: (r: any) => string) =>
    rows.map(r => ({ name: name(r), cost: r._sum.costUsd || 0, calls: r._count })).sort((a, b) => b.cost - a.cost);
  return json({
    days,
    today: tot(today), week: tot(week), month: tot(month), period: tot(period), mine: tot(mine),
    errors, lastBillingError: billing?.createdAt || null,
    byMode: group(byMode, r => r.mode), byModel: group(byModel, r => r.model),
    daily: daily.map(r => ({ day: r.day, cost: Number(r.cost), calls: Number(r.calls) })),
    top: top.map(t => { const u = users.find(x => x.id === t.userId); return { name: u ? u.email || u.handle : "Deleted account", you: !!t.userId && ex.includes(t.userId), cost: t._sum.costUsd || 0, calls: t._count }; }),
  });
}
