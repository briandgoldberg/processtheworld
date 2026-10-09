import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail } from "@/lib/http";
import { adminFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Training export: one JSON line per turn, with the map before and after, the
// AI's changes and how people judged them.
export async function GET(req: NextRequest) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  if (req.nextUrl.searchParams.get("kind") === "votes") {
    // Preference pairs: two versions of a process and which one people judged better.
    const props = await prisma.proposal.findMany({ orderBy: { createdAt: "asc" }, take: 5000, include: { votes: { select: { choice: true, reason: true, createdAt: true } } } });
    const lines = props.map(p => JSON.stringify({ id: p.id, publicId: p.publicId, note: p.note, status: p.status, baseVersion: p.baseVersion, before: p.before, after: p.after, votes: p.votes, after_votes: p.votes.filter(v => v.choice === "after").length + 1, before_votes: p.votes.filter(v => v.choice === "before").length }));
    return new Response(lines.join("\n") + "\n", { headers: { "content-type": "application/x-ndjson", "content-disposition": `attachment; filename="processtheworld-votes-${new Date().toISOString().slice(0, 10)}.jsonl"` } });
  }
  const turns = await prisma.turn.findMany({ orderBy: { createdAt: "asc" }, take: 5000, include: { ops: { orderBy: { seq: "asc" } }, questions: true } });
  const lines = turns.map(t => JSON.stringify({
    id: t.id, processId: t.processId, seq: t.seq, engineVersion: t.engineVersion, model: t.model, layer: t.mapId,
    message: t.userText, retyped: t.retyped, outcome: t.outcome,
    messageType: t.feedbackType, correctionCategory: t.feedbackCategory,
    reply: t.replySay, question: t.replyAsk, questionOutcome: t.questions[0]?.outcome ?? null, questionInfoGain: t.questions[0]?.infoGain ?? null,
    mapBefore: t.mapBefore, mapAfter: t.mapAfter, checksBefore: t.checksBefore, checksAfter: t.checksAfter,
    changes: t.ops.map(o => ({ pass: o.pass, op: o.op, layer: o.mapId, target: o.targetId, result: o.result, verdict: o.humanVerdict, emitted: o.payload, before: o.before, after: o.after })),
  }));
  return new Response(lines.join("\n") + "\n", { headers: { "content-type": "application/x-ndjson", "content-disposition": `attachment; filename="processtheworld-turns-${new Date().toISOString().slice(0, 10)}.jsonl"` } });
}
