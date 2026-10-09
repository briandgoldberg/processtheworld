import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, hashIp, json, str } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { limited } from "@/lib/rateLimit";
import { tally } from "@/lib/consensus";
import { award } from "@/lib/points";

export const dynamic = "force-dynamic";

// "Before is better" or "After is better". When consensus is reached the
// change is applied (or turned down) right away.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const b = await body(req);
  const choice = b?.choice === "before" ? "before" : b?.choice === "after" ? "after" : null;
  if (!choice) return fail("Choose before or after.");
  const p = await prisma.proposal.findUnique({ where: { id }, include: { public: true } });
  if (!p) return fail("Not found.", 404);
  if (p.status !== "open") return fail("Voting on this change has closed.");
  if (p.authorId === user.id) return fail("You suggested this change, so your vote is already counted.");
  if (await limited("vote", hashIp(req), user.id, 200, 500)) return fail("Too many votes. Try again later.", 429);
  await prisma.vote.upsert({ where: { proposalId_userId: { proposalId: id, userId: user.id } }, create: { proposalId: id, userId: user.id, choice, reason: str(b?.reason, 200) || null }, update: { choice, reason: str(b?.reason, 200) || null } });
  await prisma.event.create({ data: { userId: user.id, who: "human", type: "vote", data: { proposalId: id, publicId: p.publicId, choice } } });

  const earned = await award(user.id, "vote", id);
  const votes = await prisma.vote.findMany({ where: { proposalId: id }, select: { choice: true, userId: true } });
  const t = tally(votes, p.authorId);
  let status = "open";
  if (t.decision === "accepted") {
    const pub = p.public;
    if (pub.version !== p.baseVersion) {
      await prisma.proposal.update({ where: { id }, data: { status: "superseded", decidedAt: new Date() } });
      status = "superseded";
    } else {
      const v = pub.version + 1;
      const doc = { ...(pub.doc as any), title: p.title, maps: p.after };
      const steps = Object.values(p.after as any).reduce((a: number, m: any) => a + (m?.steps?.length || 0), 0);
      await prisma.$transaction([
        prisma.publicProcess.update({ where: { id: pub.id }, data: { doc, title: p.title, version: v, stepCount: steps as number } }),
        prisma.publicVersion.create({ data: { publicId: pub.id, version: v, title: p.title, doc, proposalId: id } }),
        prisma.proposal.update({ where: { id }, data: { status: "accepted", decidedAt: new Date() } }),
        prisma.proposal.updateMany({ where: { publicId: pub.id, status: "open", id: { not: id } }, data: { status: "superseded", decidedAt: new Date() } }),
      ]);
      status = "accepted";
      await award(p.authorId, "accepted", id);
    }
  } else if (t.decision === "rejected") {
    await prisma.proposal.update({ where: { id }, data: { status: "rejected", decidedAt: new Date() } });
    status = "rejected";
  }
  return json({ ok: true, status, after: t.after, before: t.before, myVote: choice, earned });
}
