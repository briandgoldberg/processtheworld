import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { adminFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  const rows = await prisma.interest.findMany({ orderBy: { createdAt: "desc" }, take: 500, select: { kind: true, email: true, note: true, createdAt: true } });
  return json({ count: rows.length, interest: rows });
}
