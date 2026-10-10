import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { userFrom } from "@/lib/identity";
import { cleanTag } from "@/lib/tags";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const me = await userFrom(req);
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 80);
  const tag = cleanTag(req.nextUrl.searchParams.get("tag"));
  const where: any = { AND: [
    ...(tag ? [{ tags: { has: tag } }] : []),
    ...(q ? [{ OR: [{ title: { contains: q, mode: "insensitive" } }, { authorName: { contains: q, mode: "insensitive" } }, { tags: { has: cleanTag(q) } }] }] : []),
  ] };
  const rows = await prisma.publicProcess.findMany({
    where, orderBy: { updatedAt: "desc" }, take: 300,
    select: { tags: true, hasThumb: true, publishedAt: true, commentCount: true, id: true, processId: true, title: true, authorName: true, stepCount: true, depth: true, laneTypes: true, updatedAt: true, copies: true, version: true, mode: true, likes: true, _count: { select: { proposals: { where: { status: "open" } } } } },
  });
  const mine = me ? new Set((await prisma.like.findMany({ where: { userId: me.id, publicId: { in: rows.map(r => r.id) } }, select: { publicId: true } })).map(l => l.publicId)) : new Set<string>();
  return json({ processes: rows.map(r => ({ ...r, _count: undefined, openProposals: 0, liked: mine.has(r.id), updatedAt: r.updatedAt.getTime(), publishedAt: r.publishedAt.getTime() })) });
}
