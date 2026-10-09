import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail } from "@/lib/http";
import { exportMarkdown } from "@/lib/exportMd";

export const dynamic = "force-dynamic";

// A public process as one Markdown file any AI can read in full. No key needed.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await prisma.publicProcess.findUnique({ where: { id } });
  if (!r) return fail("Not found.", 404);
  const md = exportMarkdown(r.doc as any, { author: r.authorName, url: `${new URL(req.url).origin}/p/${id}` });
  return new Response(md, { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" } });
}
