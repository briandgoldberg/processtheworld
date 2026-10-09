import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, json, str } from "@/lib/http";
import { adminFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  const status = req.nextUrl.searchParams.get("status");
  const rows = await prisma.feedback.findMany({
    where: status && status !== "all" ? { status } : {}, orderBy: { createdAt: "desc" }, take: 300,
    include: { user: { select: { handle: true, email: true } }, process: { select: { title: true } } },
  });
  return json({ feedback: rows.map(r => ({ id: r.id, kind: r.kind, rating: r.rating, reasons: r.reasons, text: r.text, context: r.context, status: r.status, created: r.createdAt, who: r.user.email || r.user.handle, processId: r.processId, process: r.process?.title || null })) });
}

export async function PATCH(req: NextRequest) {
  if (!(await adminFrom(req))) return fail("Admins only.", 403);
  const b = await body(req);
  const status = str(b?.status, 20);
  if (!["new", "reviewed", "done"].includes(status)) return fail("Invalid status.");
  await prisma.feedback.update({ where: { id: str(b?.id, 40) }, data: { status } });
  return json({ ok: true });
}
