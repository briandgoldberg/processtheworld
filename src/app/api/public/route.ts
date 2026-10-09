import { prisma } from "@/lib/db";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.publicProcess.findMany({
    orderBy: { updatedAt: "desc" }, take: 100,
    select: { id: true, processId: true, title: true, authorName: true, stepCount: true, depth: true, laneTypes: true, updatedAt: true, copies: true, version: true, _count: { select: { proposals: { where: { status: "open" } } } } },
  });
  return json({ processes: rows.map(r => ({ ...r, _count: undefined, openProposals: r._count.proposals, updatedAt: r.updatedAt.getTime() })) });
}
