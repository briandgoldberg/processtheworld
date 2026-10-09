import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, json, str } from "@/lib/http";
import { userFrom, validKey } from "@/lib/identity";
import { ENGINE_VERSION } from "@/lib/engine/prompts";

export const dynamic = "force-dynamic";

// Human and system actions, sent in small batches.
export async function POST(req: NextRequest) {
  const b = await body(req);
  // Page-unload beacons can't set headers, so they carry the key in the body.
  const user = (await userFrom(req)) || (validKey(b?.key) ? await prisma.user.findUnique({ where: { anonKey: b!.key as string } }) : null);
  if (!user) return fail("Reload the page to continue.", 401);
  const list = Array.isArray(b?.events) ? (b!.events as any[]).slice(0, 50) : [];
  if (!list.length) return json({ ok: true });
  const ids = [...new Set(list.map(e => str(e?.processId, 64)).filter(Boolean))];
  const mine = new Set((await prisma.process.findMany({ where: { id: { in: ids }, userId: user.id }, select: { id: true } })).map(p => p.id));
  const rows = list.map(e => ({
    userId: user.id, processId: mine.has(str(e?.processId, 64)) ? str(e.processId, 64) : null, turnId: str(e?.turnId, 40) || null,
    who: e?.who === "system" ? "system" : "human", type: str(e?.type, 60), data: e?.data ?? undefined, engineVersion: ENGINE_VERSION,
  })).filter(r => r.type);
  await prisma.event.createMany({ data: rows });

  // Fold verdicts back onto the turns and AI changes they judge.
  for (const r of rows) {
    if (!r.turnId) continue;
    if (r.type === "edit_message" || r.type === "retype_message") {
      await prisma.turn.updateMany({ where: { id: r.turnId, userId: user.id }, data: { outcome: r.type === "edit_message" ? "edited_message" : "retyped" } });
    } else if (r.type === "confirm_remove" || r.type === "reject_remove") {
      await prisma.op.updateMany({ where: { turnId: r.turnId, result: "proposed_removal", turn: { userId: user.id } }, data: { humanVerdict: r.type === "confirm_remove" ? "removed" : "kept" } });
    }
  }
  return json({ ok: true });
}
