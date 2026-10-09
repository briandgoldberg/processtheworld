import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { userFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const r = await prisma.proposal.updateMany({ where: { id, authorId: user.id, status: "open" }, data: { status: "withdrawn", decidedAt: new Date() } });
  return json({ ok: r.count > 0 });
}
