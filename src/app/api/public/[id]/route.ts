import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await prisma.publicProcess.findUnique({ where: { id } });
  if (!r) return fail("Not found.", 404);
  const open = await prisma.proposal.count({ where: { publicId: id, status: "open" } });
  return json({ id: r.id, processId: r.processId, authorName: r.authorName, publishedAt: r.publishedAt, updatedAt: r.updatedAt, version: r.version, mode: r.mode, openProposals: open, doc: r.doc });
}

// Counts a copy when someone turns a public process into their own.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.publicProcess.update({ where: { id }, data: { copies: { increment: 1 } } }).catch(() => {});
  return json({ ok: true });
}
