import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, json, str } from "@/lib/http";
import { userFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

// First publish creates the public process (version 1). After that, the
// publisher's updates are suggestions like anyone else's, decided by votes.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const p = await prisma.process.findUnique({ where: { id }, include: { public: true } });
  if (!p || p.userId !== user.id) return fail("Save the process first.", 404);
  if (p.proposalFor) return fail("This is a suggestion for another public process. Submit it for review instead.");
  const d = p.doc as any;
  const b = await body(req);
  if (!p.public) {
    const snapshot = { title: p.title, maps: d.maps, status: d.status || "interviewing", chat: [], events: [] };
    const mode = b?.mode === "locked" ? "locked" : "collaborative";
    const pub = await prisma.publicProcess.create({ data: { processId: id, userId: user.id, title: p.title, doc: snapshot as any, stepCount: p.stepCount, depth: p.depth, laneTypes: p.laneTypes, authorName: user.handle, mode } });
    await prisma.publicVersion.create({ data: { publicId: pub.id, version: 1, title: p.title, doc: snapshot as any } });
    return json({ ok: true, publicId: pub.id, published: true, mode });
  }
  const pub = p.public;
  if (pub.mode === "locked") {
    // Published as is: the creator's updates go live directly as a new version.
    const v = pub.version + 1;
    const snapshot = { title: p.title, maps: d.maps, status: d.status || "interviewing", chat: [], events: [] };
    await prisma.$transaction([
      prisma.publicProcess.update({ where: { id: pub.id }, data: { doc: snapshot as any, title: p.title, version: v, stepCount: p.stepCount, depth: p.depth, laneTypes: p.laneTypes } }),
      prisma.publicVersion.create({ data: { publicId: pub.id, version: v, title: p.title, doc: snapshot as any } }),
    ]);
    return json({ ok: true, publicId: pub.id, updated: true });
  }
  const open = await prisma.proposal.findFirst({ where: { publicId: pub.id, authorId: user.id, draftProcessId: id, status: "open" } });
  if (open) await prisma.proposal.update({ where: { id: open.id }, data: { status: "withdrawn", decidedAt: new Date() } });
  const prop = await prisma.proposal.create({
    data: { publicId: pub.id, authorId: user.id, draftProcessId: id, note: str(b?.note, 500) || "Update from the publisher", baseVersion: pub.version, before: (pub.doc as any).maps, after: d.maps, title: p.title },
  });
  return json({ ok: true, publicId: pub.id, proposalId: prop.id });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  await prisma.publicProcess.deleteMany({ where: { processId: id, userId: user.id } });
  return json({ ok: true });
}
