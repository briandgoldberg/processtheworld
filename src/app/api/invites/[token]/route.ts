import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await prisma.share.findUnique({ where: { token }, include: { process: { select: { title: true } }, invitedBy: { select: { handle: true } } } });
  if (!s || s.acceptedAt) return fail("This invite was already used or doesn't exist.", 404);
  const member = s.email ? await prisma.user.findFirst({ where: { email: s.email, emailVerifiedAt: { not: null } }, select: { id: true } }) : null;
  return json({ title: s.process.title, inviter: s.invitedBy.handle, email: s.email, role: s.role, hasAccount: !!member });
}
