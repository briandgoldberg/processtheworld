import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, json, str } from "@/lib/http";
import { adminFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";

// Admin-only: bring a process saved elsewhere (e.g. the first prototype) into
// the admin's own account.
export async function POST(req: NextRequest) {
  const admin = await adminFrom(req);
  if (!admin) return fail("Admins only.", 403);
  const b = await body(req);
  const doc = b?.doc as Record<string, any> | undefined;
  if (!doc?.maps || !doc?.id || !/^[A-Za-z0-9_-]{3,64}$/.test(String(doc.id))) return fail("Missing process.");
  const id = String(doc.id);
  const existing = await prisma.process.findUnique({ where: { id }, select: { userId: true } });
  if (existing && existing.userId !== admin.id) return fail("That id belongs to someone else.", 409);
  const data = {
    title: str(doc.title, 200) || "Untitled process", status: doc.status === "done" ? "done" : "interviewing", doc: doc as any,
    stepCount: Number(doc.stepCount) || 0, depth: Number(doc.depth) || 1, laneTypes: Array.isArray(doc.laneTypes) ? doc.laneTypes.map(String).slice(0, 8) : [],
  };
  await prisma.process.upsert({ where: { id }, create: { id, userId: admin.id, ...data }, update: data });
  await prisma.event.create({ data: { userId: admin.id, processId: id, who: "human", type: "imported", data: { source: str(b?.source, 80) || "prototype" } } });
  return json({ ok: true, id });
}
