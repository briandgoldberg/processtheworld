import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, json } from "@/lib/http";
import { adminFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Admin only: remove Build Together (community) processes by exact title. The usual delete refuses them on purpose.
export async function POST(req: NextRequest) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  const b = await body(req);
  const titles: string[] = Array.isArray(b?.titles) ? b.titles.filter((t: unknown) => typeof t === "string").slice(0, 100) : [];
  if (!titles.length) return fail("Send titles: a list of exact process titles.");
  const rows = await prisma.publicProcess.findMany({ where: { mode: "community", title: { in: titles } }, select: { processId: true, title: true } });
  const removed: string[] = [];
  for (const r of rows) { await prisma.process.delete({ where: { id: r.processId } }).then(() => removed.push(r.title)).catch(() => {}); }
  return json({ ok: true, removed });
}
