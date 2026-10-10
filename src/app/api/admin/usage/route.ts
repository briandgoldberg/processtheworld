import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { adminFrom } from "@/lib/identity";
import { ownerIds } from "@/lib/excludeOwner";

export const dynamic = "force-dynamic";

const KEY_EVENTS = ["process_started", "public_opened", "copy_made", "guide_started", "guide_finished", "comment", "shared", "share_x", "share_link", "import_ai", "export_ai", "export_flow", "voice_started", "suggestion_started", "compare_opened", "email_link_requested"];

// Website usage: who comes, who comes back, what they do, and how much comes from AI agents.
export async function GET(req: NextRequest) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 864e5);
  const ex = await ownerIds();
  const notMe = { id: { notIn: ex } };
  const [total, email, newTotal, newEmail, active, returning, agentCalls, agentIps] = await Promise.all([
    prisma.user.count({ where: notMe }),
    prisma.user.count({ where: { ...notMe, emailVerifiedAt: { not: null } } }),
    prisma.user.count({ where: { ...notMe, createdAt: { gte: since } } }),
    prisma.user.count({ where: { ...notMe, emailVerifiedAt: { gte: since } } }),
    prisma.user.count({ where: { ...notMe, lastSeenAt: { gte: since } } }),
    prisma.user.count({ where: { ...notMe, lastSeenAt: { gte: since }, createdAt: { lt: since } } }),
    prisma.requestLog.count({ where: { endpoint: "agent_process", createdAt: { gte: since }, OR: [{ userId: null }, { userId: { notIn: ex } }] } }),
    prisma.requestLog.groupBy({ by: ["ipHash"], where: { endpoint: "agent_process", createdAt: { gte: since }, OR: [{ userId: null }, { userId: { notIn: ex } }] } }),
  ]);
  const [dailyNew, dailyActive, dailyAgent, events] = await Promise.all([
    prisma.$queryRaw<{ day: Date; n: bigint }[]>`SELECT date_trunc('day', "createdAt") AS day, count(*)::bigint AS n FROM "User" WHERE "createdAt" >= ${since} AND NOT (id = ANY(${ex}::text[])) GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ day: Date; n: bigint }[]>`SELECT day, count(DISTINCT uid)::bigint AS n FROM (SELECT date_trunc('day', "createdAt") AS day, "userId" AS uid FROM "Event" WHERE "createdAt" >= ${since} AND NOT ("userId" = ANY(${ex}::text[])) UNION ALL SELECT date_trunc('day', "createdAt"), "userId" FROM "Turn" WHERE "createdAt" >= ${since} AND NOT ("userId" = ANY(${ex}::text[]))) t GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ day: Date; n: bigint }[]>`SELECT date_trunc('day', "createdAt") AS day, count(*)::bigint AS n FROM "RequestLog" WHERE endpoint = 'agent_process' AND "createdAt" >= ${since} AND ("userId" IS NULL OR NOT ("userId" = ANY(${ex}::text[]))) GROUP BY 1 ORDER BY 1`,
    prisma.event.groupBy({ by: ["type"], where: { createdAt: { gte: since }, who: "human", userId: { notIn: ex }, type: { in: KEY_EVENTS } }, _count: true }),
  ]);
  // Where guest accounts come from: a browser opening the site creates one, and so does an AI agent saving a process without a key
  const g = await prisma.$queryRaw<{ used: bigint; api: bigint; visitors: bigint }[]>`
    SELECT
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Event" e WHERE e."userId" = u.id) OR EXISTS (SELECT 1 FROM "Turn" t WHERE t."userId" = u.id))::bigint AS used,
      count(*) FILTER (WHERE NOT (EXISTS (SELECT 1 FROM "Event" e WHERE e."userId" = u.id) OR EXISTS (SELECT 1 FROM "Turn" t WHERE t."userId" = u.id)) AND EXISTS (SELECT 1 FROM "Process" p WHERE p."userId" = u.id))::bigint AS api,
      count(*) FILTER (WHERE NOT (EXISTS (SELECT 1 FROM "Event" e WHERE e."userId" = u.id) OR EXISTS (SELECT 1 FROM "Turn" t WHERE t."userId" = u.id)) AND NOT EXISTS (SELECT 1 FROM "Process" p WHERE p."userId" = u.id))::bigint AS visitors
    FROM "User" u WHERE u."emailVerifiedAt" IS NULL AND NOT (u.id = ANY(${ex}::text[]))`;
  const guestKinds = { used: Number(g[0]?.used || 0), api: Number(g[0]?.api || 0), visitors: Number(g[0]?.visitors || 0) };
  // Library processes still sitting on the guest accounts that built them
  const strays = await prisma.publicProcess.count({ where: { user: { handle: { in: ["SteadyMapmaker34", "BrightTinkerer61"] } } } });
  const n = (rows: { day: Date; n: bigint }[]) => rows.map(r => ({ day: r.day, n: Number(r.n) }));
  return json({
    days,
    members: { total, guests: total - email, email, newTotal, newEmail }, guestKinds, strays,
    active, returning,
    agent: { calls: agentCalls, sources: agentIps.length },
    dailyNew: n(dailyNew), dailyActive: n(dailyActive), dailyAgent: n(dailyAgent),
    events: events.map(e => ({ type: e.type, count: e._count })).sort((a, b) => b.count - a.count),
  });
}
