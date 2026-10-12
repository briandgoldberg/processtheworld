import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, hashIp, isEmail, json, str, token } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { accessTo } from "@/lib/access";
import { limited } from "@/lib/rateLimit";
import { appUrl, sendInviteEmail, sendShareNotice } from "@/lib/email";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const { process: p, role } = await accessTo(id, user.id);
  if (!p || !role) return fail("Not found.", 404);
  const [owner, rows] = await Promise.all([
    prisma.user.findUnique({ where: { id: p.userId }, select: { handle: true } }),
    prisma.share.findMany({ where: { processId: id }, orderBy: { createdAt: "asc" }, include: { user: { select: { handle: true } } } }),
  ]);
  return json({
    owner: owner?.handle, canManage: role === "owner",
    people: rows.map(s => ({ id: s.id, name: s.user?.handle || s.email, role: s.role, pending: !s.acceptedAt, you: s.userId === user.id, ...(role === "owner" && !s.acceptedAt && s.token ? { link: `${appUrl()}/invite?token=${s.token}` } : {}) })),
  });
}

// Invite someone by username, or by email (members are added right away;
// people without an account get an invite link that signs them up).
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const { process: p, role } = await accessTo(id, user.id);
  if (!p || role !== "owner") return fail("Only the owner can invite people.", 403);
  const b = await body(req);
  const who = str(b?.who, 320).trim();
  const shareRole = b?.role === "view" ? "view" : "edit";
  if (!who) return fail("Enter a username or an email address.");
  if (await limited("share_invite", hashIp(req), user.id, 40, 100)) return fail("Too many invites. Try again later.", 429);

  if (isEmail(who)) {
    const email = who.toLowerCase();
    const member = await prisma.user.findFirst({ where: { email, emailVerifiedAt: { not: null } } });
    if (member) {
      if (member.id === user.id) return fail("That's you.");
      await prisma.share.upsert({ where: { processId_userId: { processId: id, userId: member.id } }, create: { processId: id, userId: member.id, email, role: shareRole, invitedById: user.id, acceptedAt: new Date() }, update: { role: shareRole } });
      await sendShareNotice(email, user.handle, p.title);
      return json({ ok: true, added: member.handle });
    }
    const existing = await prisma.share.findFirst({ where: { processId: id, email, userId: null } });
    const t = existing?.token || token();
    if (existing) await prisma.share.update({ where: { id: existing.id }, data: { role: shareRole } });
    else await prisma.share.create({ data: { processId: id, email, role: shareRole, invitedById: user.id, token: t } });
    const r = await sendInviteEmail(email, user.handle, p.title, t);
    if (!r.ok) return fail("We couldn't send the invite email. Try again in a minute.", 502);
    return json({ ok: true, invited: email });
  }
  const member = await prisma.user.findFirst({ where: { handle: { equals: who.replace(/^@/, ""), mode: "insensitive" } } });
  if (!member) return fail("No one has that username. You can invite them by email instead.", 404);
  if (member.id === user.id) return fail("That's you.");
  await prisma.share.upsert({ where: { processId_userId: { processId: id, userId: member.id } }, create: { processId: id, userId: member.id, role: shareRole, invitedById: user.id, acceptedAt: new Date() }, update: { role: shareRole } });
  if (member.email && member.emailVerifiedAt) await sendShareNotice(member.email, user.handle, p.title);
  return json({ ok: true, added: member.handle });
}
