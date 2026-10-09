import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, hashIp, json, str } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { accessTo } from "@/lib/access";
import { limited } from "@/lib/rateLimit";
import { award } from "@/lib/points";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const b = await body(req);
  if (!b) return fail("Invalid request body.");
  if (await limited("feedback", hashIp(req), user.id, 60, 300)) return fail("Thanks, that's plenty for now.", 429);
  const kind = ["button", "reply", "finish", "checkin"].includes(String(b.kind)) ? String(b.kind) : "button";
  const processId = str(b.processId, 64);
  const own = processId && (await accessTo(processId, user.id)).role ? { id: processId } : null;
  const rating = Number.isFinite(Number(b.rating)) ? Math.max(-1, Math.min(5, Math.round(Number(b.rating)))) : null;
  const text = str(b.text, 4000).trim() || null;
  const reasons = Array.isArray(b.reasons) ? b.reasons.slice(0, 8).map(r => str(r, 60)) : [];
  if (!text && rating == null && !reasons.length) return fail("Add a note first.");
  const row = await prisma.feedback.create({
    data: { userId: user.id, processId: own?.id ?? null, turnId: str(b.turnId, 40) || null, kind, rating, reasons, text, context: (b.context as any) ?? undefined },
    select: { id: true },
  });
  const earned = text && text.length >= 10 ? await award(user.id, "feedback", row.id) : 0;
  return json({ ok: true, id: row.id, earned });
}
