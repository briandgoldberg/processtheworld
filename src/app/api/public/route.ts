import { prisma } from "@/lib/db";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.publicProcess.findMany({
    orderBy: { updatedAt: "desc" }, take: 100,
    select: { id: true, title: true, authorName: true, stepCount: true, depth: true, laneTypes: true, updatedAt: true, copies: true },
  });
  return json({ processes: rows.map(r => ({ ...r, updatedAt: r.updatedAt.getTime() })) });
}
