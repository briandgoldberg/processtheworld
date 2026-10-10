import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { publishNow } from "@/lib/publish";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

// Publishing is as is: anyone can open, like, share and copy it, but only the
// creator changes it. Calling again pushes the creator's latest edits.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const p = await prisma.process.findUnique({ where: { id }, include: { public: true } });
  if (!p || p.userId !== user.id) return fail("Save the process first.", 404);
  if (p.proposalFor) return fail("This is a draft for another process and can't be published.");
  if (p.public) return fail("Public processes cannot be changed. Make it private first.", 409);
  const r = await publishNow(user, { id, title: p.title, doc: p.doc, stepCount: p.stepCount, depth: p.depth, laneTypes: p.laneTypes }, p.public ? { id: p.public.id, version: p.public.version } : null);
  return json({ ok: true, ...r, mode: "locked" });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  await prisma.publicProcess.deleteMany({ where: { processId: id, userId: user.id } });
  return json({ ok: true });
}
