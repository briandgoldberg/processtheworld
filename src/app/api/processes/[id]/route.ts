import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, json, str } from "@/lib/http";
import { userFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const MAX_DOC = 900_000;

async function own(req: NextRequest, id: string) {
  const user = await userFrom(req);
  if (!user) return { error: fail("Reload the page to continue.", 401) } as const;
  const p = await prisma.process.findUnique({ where: { id } });
  if (p && p.userId !== user.id) return { error: fail("Not your process.", 403) } as const;
  return { user, p } as const;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const r = await own(req, id); if ("error" in r) return r.error;
  if (!r.p) return fail("Not found.", 404);
  const pub = await prisma.publicProcess.findUnique({ where: { processId: id }, select: { id: true, updatedAt: true } });
  return json({ doc: r.p.doc, publicId: pub?.id ?? null, publishedAt: pub?.updatedAt?.getTime() ?? null });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(id)) return fail("Invalid id.");
  const r = await own(req, id); if ("error" in r) return r.error;
  const b = await body(req);
  const doc = b?.doc as Record<string, any> | undefined;
  if (!doc || typeof doc !== "object" || !doc.maps) return fail("Missing process.");
  if (JSON.stringify(doc).length > MAX_DOC) return fail("This process is too large to save.", 413);
  const data = {
    title: str(doc.title, 200) || "Untitled process",
    status: doc.status === "done" ? "done" : "interviewing",
    doc: doc as any,
    stepCount: Number(doc.stepCount) || 0,
    depth: Number(doc.depth) || 1,
    laneTypes: Array.isArray(doc.laneTypes) ? doc.laneTypes.slice(0, 8).map(String) : [],
    forkedFrom: typeof doc.forkedFrom === "string" ? doc.forkedFrom.slice(0, 40) : null,
  };
  await prisma.process.upsert({ where: { id }, create: { id, userId: r.user.id, ...data }, update: data });
  return json({ ok: true });
}

// Deleting a process deletes its map, conversation and training records.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const r = await own(req, id); if ("error" in r) return r.error;
  if (r.p) await prisma.process.delete({ where: { id } });
  return json({ ok: true });
}
