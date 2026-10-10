import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { adminFrom } from "@/lib/identity";
import { ownerIds } from "@/lib/excludeOwner";

export const dynamic = "force-dynamic";

// Everything the "What to improve" page shows, in a few small queries run one after another.
export async function GET(req: NextRequest) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get("days")) || 90));
  const since = new Date(Date.now() - days * 864e5);
  const ex = await ownerIds();
  const w = { createdAt: { gte: since }, userId: { notIn: ex } };

  const forms = await prisma.feedback.findMany({
    where: { ...w, kind: { in: ["button", "checkin"] } }, orderBy: { createdAt: "desc" }, take: 200,
    select: { text: true, reasons: true, kind: true, createdAt: true, processId: true, user: { select: { handle: true, email: true } } },
  });
  const turns = await prisma.turn.count({ where: w });
  const wrong = await prisma.turn.groupBy({ by: ["feedbackCategory"], where: { ...w, feedbackType: "correction" }, _count: true });
  const corrections = await prisma.turn.findMany({
    where: { ...w, feedbackType: { in: ["correction", "confusion"] } }, orderBy: { createdAt: "desc" }, take: 25,
    select: { userText: true, feedbackType: true, feedbackCategory: true },
  });
  const skipped = await prisma.question.findMany({
    where: { createdAt: { gte: since }, process: { userId: { notIn: ex } }, outcome: { in: ["skipped", "ignored"] } }, orderBy: { createdAt: "desc" }, take: 15,
    select: { text: true },
  });
  const suggestions = await prisma.suggestion.findMany({ where: { source: "generated" }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 30 });

  return json({
    days, turns,
    forms: forms.map(f => ({ text: f.text, reasons: f.reasons, kind: f.kind, created: f.createdAt, processId: f.processId, who: f.user.email || f.user.handle })),
    wrong: wrong.map(x => ({ category: x.feedbackCategory || "other", count: x._count })).sort((a, b) => b.count - a.count),
    corrections: corrections.map(c => ({ text: c.userText, type: c.feedbackType, category: c.feedbackCategory })),
    skipped: skipped.map(q => q.text),
    suggestions,
  });
}
