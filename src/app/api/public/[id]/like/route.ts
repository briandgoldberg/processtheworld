import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { award } from "@/lib/points";

export const dynamic = "force-dynamic";

// Like or unlike a public process. The creator earns a point the first time you like it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const pub = await prisma.publicProcess.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!pub) return fail("Not found.", 404);
  const had = await prisma.like.findUnique({ where: { publicId_userId: { publicId: id, userId: user.id } } });
  if (had) {
    await prisma.like.delete({ where: { id: had.id } });
  } else {
    await prisma.like.create({ data: { publicId: id, userId: user.id } });
    if (pub.userId !== user.id) await award(pub.userId, "like", `${id}:${user.id}`);
  }
  const likes = await prisma.like.count({ where: { publicId: id } });
  await prisma.publicProcess.update({ where: { id }, data: { likes } });
  return json({ ok: true, liked: !had, likes });
}
