import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { userFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await prisma.publicProcess.findUnique({ where: { id } });
  if (!r) return fail("Not found.", 404);
  const open = 0;
  const me = await userFrom(req);
  const liked = me ? !!(await prisma.like.findUnique({ where: { publicId_userId: { publicId: id, userId: me.id } } })) : false;
  return json({ id: r.id, processId: r.processId, authorName: r.authorName, publishedAt: r.publishedAt, updatedAt: r.updatedAt, version: r.version, mode: r.mode, likes: r.likes, liked, openProposals: open, doc: r.doc });
}

// Counts a copy when someone turns a public process into their own.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.publicProcess.update({ where: { id }, data: { copies: { increment: 1 } } }).catch(() => null);
  return json({ ok: true });
}
