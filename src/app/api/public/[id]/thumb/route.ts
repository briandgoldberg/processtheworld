import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { thumbBytes } from "@/lib/thumb";

export const dynamic = "force-dynamic";

// The thumbnail of a public process, as an image. Cached; the page adds ?v=<updated> to refresh it.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await prisma.publicProcess.findUnique({ where: { id }, select: { thumb: true } });
  const t = r?.thumb ? thumbBytes(r.thumb) : null;
  if (!t) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(t.bytes), { headers: { "content-type": t.type, "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" } });
}
