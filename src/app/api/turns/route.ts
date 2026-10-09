import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, json, str } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { ENGINE_VERSION } from "@/lib/engine/prompts";
import { mapModel } from "@/lib/ai";

export const dynamic = "force-dynamic";

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(100000, Math.floor(Number(v)))) : 0);
const j = (v: unknown) => (v === undefined ? undefined : (v as any));

// One finished mapping turn: the supervised pair (map before / after), every
// AI change with before/after, the question asked, and how the previous
// question paid off.
export async function POST(req: NextRequest) {
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const b = await body(req);
  if (!b) return fail("Invalid request body.");
  const processId = str(b.processId, 64);
  const proc = await prisma.process.findUnique({ where: { id: processId }, select: { userId: true } });
  if (!proc || proc.userId !== user.id) return fail("Save the process first.", 409);
  if (JSON.stringify(b).length > 1_500_000) return fail("Turn too large.", 413);

  const fb = (b.feedback && typeof b.feedback === "object" ? b.feedback : {}) as Record<string, unknown>;
  const ops = Array.isArray(b.ops) ? b.ops.slice(0, 400) : [];
  const turn = await prisma.turn.create({
    data: {
      processId, userId: user.id, seq: n(b.seq), engineVersion: ENGINE_VERSION, model: mapModel(),
      mapId: str(b.mapId, 80), userText: str(b.userText, 4000), retyped: !!b.retyped,
      replySay: str(b.replySay, 2000) || null, replyAsk: str(b.replyAsk, 1000) || null,
      feedbackType: str(fb.type, 40) || null, feedbackCategory: str(fb.category, 40) || null, feedbackAbout: str(fb.about, 120) || null,
      opsApplied: n(b.opsApplied), removalsProposed: n(b.removalsProposed), checksFound: n(b.checksFound), checksRepaired: n(b.checksRepaired),
      mapBefore: j(b.mapBefore) ?? {}, mapAfter: j(b.mapAfter) ?? {}, checksBefore: j(b.checksBefore), checksAfter: j(b.checksAfter),
      mainCallId: str(b.mainCallId, 40) || null, repairCallId: str(b.repairCallId, 40) || null, error: str(b.error, 300) || null,
      ops: { create: ops.map((o: any, i: number) => ({
        seq: i, pass: o?.pass === "repair" ? "repair" : "main", op: str(o?.op, 40), mapId: str(o?.mapId, 80) || null, targetId: str(o?.targetId, 80) || null,
        result: str(o?.result, 40) || "applied", payload: o?.payload ?? {}, before: o?.before ?? undefined, after: o?.after ?? undefined,
      })) },
    },
    select: { id: true },
  });

  // Close out the previous question: answered, skipped, or ignored, and how much it moved the map.
  const prev = await prisma.question.findFirst({ where: { processId, answeredTurnId: null, outcome: null }, orderBy: { createdAt: "desc" } });
  if (prev) {
    const outcome = b.skippedLastQuestion ? "skipped" : fb.type === "answer" ? "answered" : "ignored";
    await prisma.question.update({ where: { id: prev.id }, data: { answeredTurnId: turn.id, outcome, infoGain: n(b.opsApplied) } });
  }
  if (b.replyAsk) await prisma.question.create({ data: { processId, askedTurnId: turn.id, text: str(b.replyAsk, 1000) } });
  return json({ ok: true, turnId: turn.id });
}
