import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { adminFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  const { id } = await params;
  const p = await prisma.process.findUnique({ where: { id }, include: { user: { select: { handle: true, email: true } } } });
  if (!p) return fail("Not found.", 404);
  const [turns, events, feedback, questions, calls] = await Promise.all([
    prisma.turn.findMany({ where: { processId: id }, orderBy: { createdAt: "asc" }, include: { ops: { orderBy: { seq: "asc" } } } }),
    prisma.event.findMany({ where: { processId: id }, orderBy: { createdAt: "asc" }, take: 1000 }),
    prisma.feedback.findMany({ where: { processId: id }, orderBy: { createdAt: "asc" } }),
    prisma.question.findMany({ where: { processId: id }, orderBy: { createdAt: "asc" } }),
    prisma.aiCall.findMany({ where: { processId: id }, orderBy: { createdAt: "asc" }, select: { id: true, mode: true, model: true, inputTokens: true, outputTokens: true, costUsd: true, latencyMs: true, error: true, createdAt: true } }),
  ]);
  return json({ process: { id: p.id, title: p.title, status: p.status, who: p.user.email || p.user.handle, doc: p.doc }, turns, events, feedback, questions, calls });
}
