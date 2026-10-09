import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { userFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";

const sel = { id: true, title: true, status: true, stepCount: true, depth: true, laneTypes: true, updatedAt: true, proposalFor: true, public: { select: { id: true, mode: true } }, _count: { select: { shares: true } } } as const;

// Your processes, plus the ones people have shared with you.
export async function GET(req: NextRequest) {
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const [mine, shares] = await Promise.all([
    prisma.process.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 200, select: sel }),
    prisma.share.findMany({ where: { userId: user.id, acceptedAt: { not: null } }, take: 200, select: { role: true, process: { select: { ...sel, user: { select: { handle: true } } } } } }),
  ]);
  const row = (r: any) => ({ id: r.id, title: r.title, status: r.status, stepCount: r.stepCount, depth: r.depth, laneTypes: r.laneTypes, updatedAt: r.updatedAt.getTime(), proposalFor: r.proposalFor, publicId: r.public?.id ?? null, publicMode: r.public?.mode ?? null, shareCount: r._count.shares });
  return json({
    processes: mine.map(row),
    shared: shares.filter(s => s.process).map(s => ({ ...row(s.process), role: s.role, owner: s.process.user.handle })).sort((a, b) => b.updatedAt - a.updatedAt),
  });
}
