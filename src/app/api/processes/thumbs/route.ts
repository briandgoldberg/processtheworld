import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { userFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";

// Thumbnails for many of your cards in one request (one database query, not one per card).
// Only processes you own or that were shared with you; ones without a thumbnail are left out.
export async function GET(req: NextRequest) {
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const ids = (req.nextUrl.searchParams.get("ids") || "").split(",").map(s => s.trim()).filter(s => /^[A-Za-z0-9_-]{1,40}$/.test(s)).slice(0, 40);
  if (!ids.length) return json({ thumbs: {} });
  const rows = await prisma.$queryRaw<{ id: string; thumb: string | null }[]>`
    SELECT p.id, p.doc->>'thumb' AS thumb FROM "Process" p
    WHERE p.id = ANY(${ids}) AND (p."userId" = ${user.id} OR EXISTS (SELECT 1 FROM "Share" s WHERE s."processId" = p.id AND s."userId" = ${user.id} AND s."acceptedAt" IS NOT NULL))`;
  const thumbs: Record<string, string> = {};
  for (const r of rows) if (r.thumb && /^data:image\/(png|jpeg|webp);base64,/.test(r.thumb)) thumbs[r.id] = r.thumb;
  return json({ thumbs });
}
