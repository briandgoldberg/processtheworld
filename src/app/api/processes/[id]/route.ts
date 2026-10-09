import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, json, str } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { accessTo, canEdit } from "@/lib/access";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const MAX_DOC = 900_000;

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const { process: p, role } = await accessTo(id, user.id);
  if (!p || !role) return fail("Not found.", 404);
  if (req.nextUrl.searchParams.get("rev")) return json({ rev: p.rev }); // cheap check for newer saves
  const [pub, owner] = await Promise.all([
    prisma.publicProcess.findUnique({ where: { processId: id }, select: { id: true, version: true } }),
    role === "owner" ? null : prisma.user.findUnique({ where: { id: p.userId }, select: { handle: true } }),
  ]);
  return json({ doc: p.doc, rev: p.rev, role, owner: owner?.handle ?? null, publicId: pub?.id ?? null, proposalFor: p.proposalFor, proposalBase: p.proposalBase });
}

// Save. Sends the revision it started from; if someone else saved in between,
// the save is refused and the newer version comes back instead.
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(id)) return fail("Invalid id.");
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const b = await body(req);
  const doc = b?.doc as Record<string, any> | undefined;
  if (!doc || typeof doc !== "object" || !doc.maps) return fail("Missing process.");
  if (JSON.stringify(doc).length > MAX_DOC) return fail("This process is too large to save.", 413);
  const { process: p, role } = await accessTo(id, user.id);
  if (p && !canEdit(role)) return fail("You can view this process but not edit it.", 403);
  const data = {
    title: str(doc.title, 200) || "Untitled process",
    status: doc.status === "done" ? "done" : "interviewing",
    doc: doc as any,
    stepCount: Number(doc.stepCount) || 0,
    depth: Number(doc.depth) || 1,
    laneTypes: Array.isArray(doc.laneTypes) ? doc.laneTypes.slice(0, 8).map(String) : [],
  };
  if (!p) {
    const created = await prisma.process.create({
      data: { id, userId: user.id, ...data, forkedFrom: typeof doc.forkedFrom === "string" ? doc.forkedFrom.slice(0, 40) : null,
        proposalFor: typeof doc.proposalFor === "string" ? doc.proposalFor.slice(0, 40) : null, proposalBase: Number.isFinite(Number(doc.proposalBase)) ? Number(doc.proposalBase) : null },
      select: { rev: true },
    });
    return json({ ok: true, rev: created.rev });
  }
  const baseRev = Number(b?.baseRev);
  const r = await prisma.process.updateMany({ where: { id, ...(Number.isFinite(baseRev) && baseRev > 0 ? { rev: baseRev } : {}) }, data: { ...data, rev: { increment: 1 } } });
  if (r.count === 0) {
    const cur = await prisma.process.findUnique({ where: { id }, select: { doc: true, rev: true } });
    return json({ error: "Someone else changed this process.", code: "conflict", doc: cur?.doc, rev: cur?.rev }, 409);
  }
  const after = await prisma.process.findUnique({ where: { id }, select: { rev: true } });
  return json({ ok: true, rev: after?.rev });
}

// The owner deletes the process (with its training records). Someone it was
// shared with removes it from their list instead.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const { process: p, role } = await accessTo(id, user.id);
  if (!p) return json({ ok: true });
  if (role === "owner") await prisma.process.delete({ where: { id } });
  else await prisma.share.deleteMany({ where: { processId: id, userId: user.id } });
  return json({ ok: true, left: role !== "owner" });
}
