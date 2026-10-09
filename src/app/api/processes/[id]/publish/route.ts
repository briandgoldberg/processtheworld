import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { userFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

// Publish (or refresh) a read-only snapshot of your process. Private notes
// stay out: the conversation and the event log are not published.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const p = await prisma.process.findUnique({ where: { id } });
  if (!p || p.userId !== user.id) return fail("Save the process first.", 404);
  const d = p.doc as any;
  const snapshot = { id: p.id, title: p.title, maps: d.maps, status: d.status || "interviewing", chat: [], events: [] };
  const data = { title: p.title, doc: snapshot as any, stepCount: p.stepCount, depth: p.depth, laneTypes: p.laneTypes, authorName: user.handle };
  const r = await prisma.publicProcess.upsert({ where: { processId: id }, create: { processId: id, userId: user.id, ...data }, update: data });
  return json({ ok: true, publicId: r.id, authorName: r.authorName, publishedAt: r.publishedAt });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  await prisma.publicProcess.deleteMany({ where: { processId: id, userId: user.id } });
  return json({ ok: true });
}
