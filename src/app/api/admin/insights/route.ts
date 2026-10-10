import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { adminFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";

// What the interviews and feedback say about the process builder: where it goes wrong and where it works.
export async function GET(req: NextRequest) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 864e5), w = { createdAt: { gte: since } };
  const [turns, corrections, confusion, aiErrors, aiCalls, skipped, best, reasons, down, perProcess, corrected] = await Promise.all([
    prisma.turn.count({ where: w }),
    prisma.turn.count({ where: { ...w, feedbackType: "correction" } }),
    prisma.turn.count({ where: { ...w, feedbackType: "confusion" } }),
    prisma.aiCall.count({ where: { ...w, error: { not: null } } }),
    prisma.aiCall.count({ where: w }),
    prisma.question.findMany({ where: { ...w, outcome: { in: ["skipped", "ignored"] } }, orderBy: { createdAt: "desc" }, take: 12, select: { text: true, outcome: true } }),
    prisma.question.findMany({ where: { ...w, outcome: "answered", infoGain: { gte: 3 } }, orderBy: { infoGain: "desc" }, take: 8, select: { text: true, infoGain: true } }),
    prisma.$queryRaw<{ reason: string; n: bigint }[]>`SELECT unnest(reasons) AS reason, count(*)::bigint AS n FROM "Feedback" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
    prisma.feedback.findMany({ where: { ...w, kind: "reply", rating: -1 }, orderBy: { createdAt: "desc" }, take: 10, select: { text: true, reasons: true } }),
    prisma.$queryRaw<{ turns: number; n: bigint }[]>`SELECT LEAST(c, 10)::int AS turns, count(*)::bigint AS n FROM (SELECT count(*) AS c FROM "Turn" WHERE "createdAt" >= ${since} GROUP BY "processId") t GROUP BY 1 ORDER BY 1`,
    prisma.turn.findMany({ where: { ...w, feedbackType: { in: ["correction", "confusion"] } }, orderBy: { createdAt: "desc" }, take: 12, select: { userText: true, feedbackCategory: true, feedbackType: true } }),
  ]);
  return json({
    days, turns, corrections, confusion, aiErrors, aiCalls,
    skippedQuestions: skipped, bestQuestions: best, feedbackReasons: reasons.map(r => ({ reason: r.reason, count: Number(r.n) })), thumbsDown: down,
    turnsPerProcess: perProcess.map(p => ({ turns: Number(p.turns), count: Number(p.n) })), corrected,
  });
}
