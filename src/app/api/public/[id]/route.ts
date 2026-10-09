import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { award } from "@/lib/points";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await prisma.publicProcess.findUnique({ where: { id } });
  if (!r) return fail("Not found.", 404);
  const open = await prisma.proposal.count({ where: { publicId: id, status: "open" } });
  return json({ id: r.id, processId: r.processId, authorName: r.authorName, publishedAt: r.publishedAt, updatedAt: r.updatedAt, version: r.version, mode: r.mode, openProposals: open, doc: r.doc });
}

// Counts a copy when someone turns a public process into their own.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pub = await prisma.publicProcess.update({ where: { id }, data: { copies: { increment: 1 } } }).catch(() => null);
  const user = await userFrom(req);
  if (pub && user && pub.userId !== user.id) await award(pub.userId, "copy", `${id}:${user.id}`);
  return json({ ok: true });
}
