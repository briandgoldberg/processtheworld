import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { userFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";

// Type-ahead for the invite box: usernames that start with what was typed. Usernames are already public (they show as "Published by"); emails never appear here.
export async function GET(req: NextRequest) {
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 30);
  if (q.length < 1 || q.includes("@")) return json({ handles: [] });
  const rows = await prisma.user.findMany({ where: { handle: { startsWith: q, mode: "insensitive" }, id: { not: user.id } }, orderBy: { handle: "asc" }, take: 6, select: { handle: true } });
  return json({ handles: rows.map(r => r.handle) });
}
