import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, hashIp, json } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { limited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Opening a build together link makes you an editor of that process.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const p = await prisma.process.findUnique({ where: { id }, select: { id: true, userId: true, openEdit: true } });
  if (!p || !p.openEdit) return fail("This link is not open for editing.", 404);
  if (p.userId === user.id) return json({ ok: true, role: "owner" });
  const have = await prisma.share.findFirst({ where: { processId: id, userId: user.id } });
  if (have?.acceptedAt) return json({ ok: true, role: have.role });
  if (await limited("build_join", hashIp(req), user.id, 60, 200)) return fail("Too many requests. Try again later.", 429);
  if (have) await prisma.share.update({ where: { id: have.id }, data: { role: "edit", acceptedAt: new Date() } });
  else await prisma.share.create({ data: { processId: id, userId: user.id, role: "edit", invitedById: p.userId, acceptedAt: new Date() } });
  return json({ ok: true, role: "edit" });
}
