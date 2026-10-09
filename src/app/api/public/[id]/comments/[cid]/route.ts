import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { userFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";

// The author of a comment, or the owner of the process, can delete it.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const c = await prisma.comment.findUnique({ where: { id: cid }, include: { public: { select: { userId: true } } } });
  if (!c || c.publicId !== id) return json({ ok: true });
  if (c.userId !== user.id && c.public.userId !== user.id) return fail("Only the author or the process owner can delete a comment.", 403);
  await prisma.comment.delete({ where: { id: cid } });
  const count = await prisma.comment.count({ where: { publicId: id } });
  await prisma.publicProcess.update({ where: { id }, data: { commentCount: count } });
  return json({ ok: true, commentCount: count });
}
