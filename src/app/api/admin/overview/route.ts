import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { adminFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 864e5);
  const w = { createdAt: { gte: since } };
  const [users, verified, newUsers, processes, finished, turns, ai, corrections, feedbackTypes, events, questions, gain, ratings, thumbs, newFeedback, removals] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
    prisma.user.count({ where: w }),
    prisma.process.count(),
    prisma.process.count({ where: { status: "done" } }),
    prisma.turn.count({ where: w }),
    prisma.aiCall.aggregate({ where: w, _sum: { costUsd: true, inputTokens: true, outputTokens: true }, _count: true, _avg: { latencyMs: true } }),
    prisma.turn.groupBy({ by: ["feedbackCategory"], where: { ...w, feedbackType: "correction" }, _count: true }),
    prisma.turn.groupBy({ by: ["feedbackType"], where: w, _count: true }),
    prisma.event.groupBy({ by: ["type"], where: w, _count: true }),
    prisma.question.groupBy({ by: ["outcome"], where: w, _count: true }),
    prisma.question.aggregate({ where: { ...w, outcome: "answered" }, _avg: { infoGain: true } }),
    prisma.feedback.aggregate({ where: { ...w, kind: "finish" }, _avg: { rating: true }, _count: true }),
    prisma.feedback.groupBy({ by: ["rating"], where: { ...w, kind: "reply" }, _count: true }),
    prisma.feedback.count({ where: { status: "new" } }),
    prisma.op.groupBy({ by: ["humanVerdict"], where: { result: "proposed_removal", turn: w }, _count: true }),
  ]);
  const checks = await prisma.event.findMany({ where: { ...w, type: { in: ["check_dismissed", "check_sent_to_ai", "check_made_decision"] } }, select: { type: true, data: true }, take: 5000 });
  const byKind: Record<string, { dismissed: number; fixed: number }> = {};
  for (const c of checks) {
    const k = String((c.data as any)?.kind || "other").split(":")[0];
    byKind[k] ||= { dismissed: 0, fixed: 0 };
    if (c.type === "check_dismissed") byKind[k].dismissed++; else byKind[k].fixed++;
  }
  const daily = await prisma.$queryRaw<{ day: Date; turns: bigint }[]>`SELECT date_trunc('day', "createdAt") AS day, count(*)::bigint AS turns FROM "Turn" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`;
  return json({
    days, users, verified, newUsers, processes, finished, turns,
    ai: { calls: ai._count, cost: ai._sum.costUsd || 0, input: ai._sum.inputTokens || 0, output: ai._sum.outputTokens || 0, avgLatency: Math.round(ai._avg.latencyMs || 0) },
    corrections: corrections.map(c => ({ category: c.feedbackCategory || "other", count: c._count })).sort((a, b) => b.count - a.count),
    messageTypes: feedbackTypes.map(c => ({ type: c.feedbackType || "unclassified", count: c._count })).sort((a, b) => b.count - a.count),
    events: events.map(e => ({ type: e.type, count: e._count })).sort((a, b) => b.count - a.count),
    questions: questions.map(q => ({ outcome: q.outcome || "open", count: q._count })),
    avgInfoGain: gain._avg.infoGain,
    finish: { avg: ratings._avg.rating, count: ratings._count },
    thumbs: { up: thumbs.find(t => t.rating === 1)?._count || 0, down: thumbs.find(t => t.rating === -1)?._count || 0 },
    checks: byKind,
    removals: removals.map(r => ({ verdict: r.humanVerdict || "pending", count: r._count })),
    newFeedback,
    daily: daily.map(d => ({ day: d.day, turns: Number(d.turns) })),
  });
}
