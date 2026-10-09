import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, json, str } from "@/lib/http";
import { adminFrom } from "@/lib/identity";
import { ensureSeeded } from "@/lib/suggestions";
import { analysisModel, completeAndLog } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  await ensureSeeded();
  const rows = await prisma.suggestion.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  return json({ suggestions: rows });
}

export async function PATCH(req: NextRequest) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  const b = await body(req);
  const status = str(b?.status, 20);
  if (!["open", "planned", "done", "dismissed"].includes(status)) return fail("Invalid status.");
  await prisma.suggestion.update({ where: { id: str(b?.id, 40) }, data: { status } });
  return json({ ok: true });
}

// Ask Claude to read the recent learning signal and propose product changes.
export async function POST(req: NextRequest) {
  const admin = await adminFrom(req);
  if (!admin) return fail("Admins only.", 403);
  if (!process.env.ANTHROPIC_API_KEY) return fail("ANTHROPIC_API_KEY is not set.", 503);
  const since = new Date(Date.now() - 30 * 864e5);
  const [corrections, feedback, checks, questions, existing] = await Promise.all([
    prisma.turn.findMany({ where: { createdAt: { gte: since }, feedbackType: { in: ["correction", "confusion"] } }, orderBy: { createdAt: "desc" }, take: 60, select: { userText: true, replySay: true, feedbackType: true, feedbackCategory: true } }),
    prisma.feedback.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 80, select: { kind: true, rating: true, reasons: true, text: true } }),
    prisma.event.groupBy({ by: ["type"], where: { createdAt: { gte: since } }, _count: true }),
    prisma.question.findMany({ where: { createdAt: { gte: since }, outcome: { not: null } }, orderBy: { createdAt: "desc" }, take: 60, select: { text: true, outcome: true, infoGain: true } }),
    prisma.suggestion.findMany({ where: { status: { in: ["open", "planned"] } }, select: { title: true } }),
  ]);
  const system = "You review usage data for Process the World, an app where people describe a process in conversation and an AI builds a swim-lane process map, interviewing them as it goes. Every interaction is training data for a future in-house interview and mapping model. Propose specific product or engine changes backed by the data. Reply with only a JSON array of up to 6 objects: {\"title\": short imperative, \"body\": 2-3 plain sentences on what to change and why, \"evidence\": short quote or count from the data}. Skip ideas already on the open list.";
  const text = JSON.stringify({ corrections, feedback, eventCounts: checks.map(c => ({ type: c.type, count: c._count })), questions, alreadyOpen: existing.map(e => e.title) });
  const out = await completeAndLog({ userId: admin.id, processId: null, mode: "suggest", model: analysisModel() }, system, text.slice(0, 150000));
  let list: any[] = [];
  try { list = JSON.parse(out.slice(out.indexOf("["), out.lastIndexOf("]") + 1)); } catch { return fail("Couldn't read the suggestions. Try again.", 502); }
  const rows = list.slice(0, 6).filter(s => s?.title && s?.body).map(s => ({ title: str(s.title, 200), body: str(s.body, 2000), evidence: { note: str(s.evidence, 500) }, source: "generated" }));
  if (rows.length) await prisma.suggestion.createMany({ data: rows });
  return json({ added: rows.length });
}
