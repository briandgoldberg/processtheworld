import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, hashIp, json, str } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { limited } from "@/lib/rateLimit";
import { RULE_TEXT, tally } from "@/lib/consensus";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

// Only community (collaborative) processes take suggestions. Everything else is published as is.
const AS_IS = "This process is published as is. Make your own copy to change it.";

// Suggested changes, newest first, with vote tallies and your own vote.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const pub = await prisma.publicProcess.findUnique({ where: { id }, select: { mode: true } });
  if (!pub || pub.mode !== "community") return json({ rule: "", proposals: [] });
  const user = await userFrom(req);
  const status = req.nextUrl.searchParams.get("status") || "open";
  const rows = await prisma.proposal.findMany({
    where: { publicId: id, ...(status === "all" ? {} : { status }) }, orderBy: { createdAt: "desc" }, take: 50,
    include: { author: { select: { handle: true } }, votes: { select: { choice: true, userId: true } } },
  });
  return json({
    rule: RULE_TEXT,
    proposals: rows.map(p => {
      const t = tally(p.votes, p.authorId);
      return { id: p.id, note: p.note, title: p.title, author: p.author.handle, mine: p.authorId === user?.id, status: p.status, baseVersion: p.baseVersion, createdAt: p.createdAt, decidedAt: p.decidedAt,
        after: t.after, before: t.before, myVote: user ? p.votes.find(v => v.userId === user.id)?.choice ?? null : null, mapsBefore: p.before, mapsAfter: p.after };
    }),
  });
}

// Submit a suggestion: a private draft started from the community process (Process.proposalFor).
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const b = await body(req);
  const pub = await prisma.publicProcess.findUnique({ where: { id } });
  if (!pub) return fail("Not found.", 404);
  if (pub.mode !== "community") return fail(AS_IS, 403);
  const draft = await prisma.process.findUnique({ where: { id: str(b?.processId, 64) } });
  if (!draft || draft.userId !== user.id || draft.proposalFor !== id) return fail("Describe your change in the conversation first.");
  if (draft.proposalBase !== pub.version) return fail("The community version changed since you started. Open it again and describe your change on the latest version.", 409, "outdated");
  if (!draft.stepCount) return fail("This suggestion has no steps.");
  if (await limited("proposal", hashIp(req), user.id, 20, 30)) return fail("Too many suggestions. Try again later.", 429);
  const note = str(b?.note, 500).trim();
  if (!note) return fail("Add a short note about what you changed.");
  await prisma.proposal.updateMany({ where: { draftProcessId: draft.id, status: "open" }, data: { status: "withdrawn", decidedAt: new Date() } });
  const p = await prisma.proposal.create({ data: { publicId: id, authorId: user.id, draftProcessId: draft.id, note, baseVersion: pub.version, before: (pub.doc as any).maps, after: (draft.doc as any).maps, title: draft.title } });
  await prisma.event.create({ data: { userId: user.id, processId: draft.id, who: "human", type: "proposal_submitted", data: { proposalId: p.id, publicId: id } } });
  return json({ ok: true, proposalId: p.id });
}
