import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { userFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const rows = await prisma.process.findMany({
    where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 200,
    select: { id: true, title: true, status: true, stepCount: true, depth: true, laneTypes: true, updatedAt: true, public: { select: { id: true, updatedAt: true } } },
  });
  return json({ processes: rows.map(r => ({ ...r, public: undefined, publicId: r.public?.id ?? null, publishedAt: r.public?.updatedAt?.getTime() ?? null, updatedAt: r.updatedAt.getTime() })) });
}
