import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const LIFETIME_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("token") ?? "";
  const row = t ? await prisma.emailToken.findUnique({ where: { token: t } }) : null;
  if (!row || row.kind !== "verify" || Date.now() - row.createdAt.getTime() > LIFETIME_MS) return NextResponse.redirect(new URL("/?alert=link-invalid", req.url));
  if (!row.usedAt) {
    // Re-check at confirm time: two browsers could race to claim the same email.
    const owner = await prisma.user.findUnique({ where: { email: row.email } });
    if (owner && owner.id !== row.userId && owner.emailVerifiedAt) return NextResponse.redirect(new URL("/?alert=email-taken", req.url));
    await prisma.$transaction([
      ...(owner && owner.id !== row.userId ? [prisma.user.update({ where: { id: owner.id }, data: { email: null } })] : []),
      prisma.user.update({ where: { id: row.userId }, data: { email: row.email, emailVerifiedAt: new Date() } }),
      prisma.emailToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    ]);
  }
  return NextResponse.redirect(new URL("/?alert=saved", req.url));
}
