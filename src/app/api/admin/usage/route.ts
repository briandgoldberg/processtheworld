import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { adminFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";

const KEY_EVENTS = ["process_started", "public_opened", "copy_made", "guide_started", "guide_finished", "comment", "shared", "share_x", "share_link", "import_ai", "export_ai", "export_flow", "voice_started", "suggestion_started", "compare_opened", "email_link_requested"];

// Website usage: who comes, who comes back, what they do, and how much comes from AI agents.
export async function GET(req: NextRequest) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 864e5);
  const [total, email, newTotal, newEmail, active, returning, agentCalls, agentIps] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({ where: { emailVerifiedAt: { gte: since } } }),
    prisma.user.count({ where: { lastSeenAt: { gte: since } } }),
    prisma.user.count({ where: { lastSeenAt: { gte: since }, createdAt: { lt: since } } }),
    prisma.requestLog.count({ where: { endpoint: "agent_process", createdAt: { gte: since } } }),
    prisma.requestLog.groupBy({ by: ["ipHash"], where: { endpoint: "agent_process", createdAt: { gte: since } } }),
  ]);
  const [dailyNew, dailyActive, dailyAgent, events] = await Promise.all([
    prisma.$queryRaw<{ day: Date; n: bigint }[]>`SELECT date_trunc('day', "createdAt") AS day, count(*)::bigint AS n FROM "User" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ day: Date; n: bigint }[]>`SELECT day, count(DISTINCT uid)::bigint AS n FROM (SELECT date_trunc('day', "createdAt") AS day, "userId" AS uid FROM "Event" WHERE "createdAt" >= ${since} UNION ALL SELECT date_trunc('day', "createdAt"), "userId" FROM "Turn" WHERE "createdAt" >= ${since}) t GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ day: Date; n: bigint }[]>`SELECT date_trunc('day', "createdAt") AS day, count(*)::bigint AS n FROM "RequestLog" WHERE endpoint = 'agent_process' AND "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
    prisma.event.groupBy({ by: ["type"], where: { createdAt: { gte: since }, who: "human", type: { in: KEY_EVENTS } }, _count: true }),
  ]);
  const n = (rows: { day: Date; n: bigint }[]) => rows.map(r => ({ day: r.day, n: Number(r.n) }));
  return json({
    days,
    members: { total, guests: total - email, email, newTotal, newEmail },
    active, returning,
    agent: { calls: agentCalls, sources: agentIps.length },
    dailyNew: n(dailyNew), dailyActive: n(dailyActive), dailyAgent: n(dailyAgent),
    events: events.map(e => ({ type: e.type, count: e._count })).sort((a, b) => b.count - a.count),
  });
}
