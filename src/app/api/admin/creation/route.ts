import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { adminFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";

// Creating and publishing: how many processes get made, how far they get, and what people like.
export async function GET(req: NextRequest) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 864e5), stale = new Date(Date.now() - 3 * 864e5);
  const w = { createdAt: { gte: since } };
  const mine = { ...w, proposalFor: null };
  const [created, withTurns, finished, big, abandoned, published, totals, newLikes, newComments, proposals, started, byAgent] = await Promise.all([
    prisma.process.count({ where: mine }),
    prisma.process.count({ where: { ...mine, turns: { some: {} } } }),
    prisma.process.count({ where: { ...mine, status: "done" } }),
    prisma.process.count({ where: { ...mine, stepCount: { gte: 8 } } }),
    prisma.process.count({ where: { ...mine, status: { not: "done" }, updatedAt: { lt: stale }, turns: { some: {} } } }),
    prisma.publicProcess.count({ where: { publishedAt: { gte: since } } }),
    prisma.publicProcess.aggregate({ _sum: { copies: true, likes: true, commentCount: true } }),
    prisma.like.count({ where: w }),
    prisma.comment.count({ where: w }),
    prisma.proposal.count({ where: w }),
    prisma.event.count({ where: { ...w, type: "process_started", who: "human" } }),
    prisma.process.count({ where: { ...mine, turns: { none: {} }, status: "done" } }),
  ]);
  const [dailyCreated, dailyPublished, top, recent, avg, tags] = await Promise.all([
    prisma.$queryRaw<{ day: Date; n: bigint }[]>`SELECT date_trunc('day', "createdAt") AS day, count(*)::bigint AS n FROM "Process" WHERE "createdAt" >= ${since} AND "proposalFor" IS NULL GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ day: Date; n: bigint }[]>`SELECT date_trunc('day', "publishedAt") AS day, count(*)::bigint AS n FROM "PublicProcess" WHERE "publishedAt" >= ${since} GROUP BY 1 ORDER BY 1`,
    prisma.publicProcess.findMany({ orderBy: [{ likes: "desc" }, { copies: "desc" }], take: 10, select: { id: true, title: true, authorName: true, likes: true, copies: true, commentCount: true, stepCount: true } }),
    prisma.publicProcess.findMany({ orderBy: { publishedAt: "desc" }, take: 15, select: { id: true, title: true, authorName: true, likes: true, copies: true, stepCount: true, depth: true, publishedAt: true } }),
    prisma.process.aggregate({ where: { ...mine, status: "done" }, _avg: { stepCount: true, depth: true } }),
    prisma.$queryRaw<{ tag: string; n: bigint }[]>`SELECT unnest(tags) AS tag, count(*)::bigint AS n FROM "PublicProcess" GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
  ]);
  const n = (rows: { day: Date; n: bigint }[]) => rows.map(r => ({ day: r.day, n: Number(r.n) }));
  return json({
    days, started, created, withTurns, finished, big, abandoned, published, byAgent, avgSteps: avg._avg.stepCount, avgLayers: avg._avg.depth,
    totals: { copies: totals._sum.copies || 0, likes: totals._sum.likes || 0, comments: totals._sum.commentCount || 0 }, newLikes, newComments, proposals,
    dailyCreated: n(dailyCreated), dailyPublished: n(dailyPublished), tags: tags.map(t => ({ tag: t.tag, count: Number(t.n) })), top, recent,
  });
}
