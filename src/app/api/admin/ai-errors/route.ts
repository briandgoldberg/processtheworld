import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { adminFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";

// The latest failed AI calls, so a setup problem is visible without digging through logs.
export async function GET(req: NextRequest) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  const rows = await prisma.aiCall.findMany({ where: { error: { not: null } }, orderBy: { createdAt: "desc" }, take: 8, select: { createdAt: true, model: true, mode: true, error: true } });
  return json({ errors: rows.map(r => ({ at: r.createdAt, model: r.model, mode: r.mode, error: r.error })) });
}
