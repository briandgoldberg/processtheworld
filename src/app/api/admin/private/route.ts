import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { adminFrom } from "@/lib/identity";
import { ownerIds } from "@/lib/excludeOwner";

export const dynamic = "force-dynamic";

// New private processes: made in the chosen period, never published, and not a draft suggestion
// for a public one. Admins only; each opens read-only through /api/admin/sessions/[id].
export async function GET(req: NextRequest) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 864e5);
  const ex = await ownerIds();
  const rows = await prisma.process.findMany({
    where: { userId: { notIn: ex }, createdAt: { gte: since }, public: { is: null }, proposalFor: null },
    orderBy: { createdAt: "desc" }, take: 200,
    select: { id: true, title: true, status: true, stepCount: true, depth: true, forkedFrom: true, createdAt: true, updatedAt: true, user: { select: { handle: true, email: true } }, _count: { select: { shares: true } } },
  });
  return json({
    days,
    processes: rows.map(r => ({
      id: r.id, title: r.title, status: r.status, steps: r.stepCount, layers: r.depth, copy: !!r.forkedFrom, shared: r._count.shares,
      who: r.user.email || r.user.handle, created: r.createdAt, updated: r.updatedAt,
    })),
  });
}
