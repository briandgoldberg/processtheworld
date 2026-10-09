import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, hashIp, json, str } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { limited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

// Comments on a public process, oldest first so a thread reads top to bottom.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const me = await userFrom(req);
  const pub = await prisma.publicProcess.findUnique({ where: { id }, select: { userId: true } });
  if (!pub) return fail("Not found.", 404);
  const rows = await prisma.comment.findMany({ where: { publicId: id }, orderBy: { createdAt: "asc" }, take: 200 });
  return json({
    isOwner: !!me && me.id === pub.userId,
    comments: rows.map(c => ({ id: c.id, author: c.authorName, body: c.body, createdAt: c.createdAt.getTime(), stepRef: c.stepRef, stepLabel: c.stepLabel, mine: !!me && me.id === c.userId })),
  });
}

// Add a comment, optionally pinned to a step ("mapId|stepId").
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Send your key in the x-ptw-key header (or reload the page).", 401);
  const pub = await prisma.publicProcess.findUnique({ where: { id }, select: { doc: true } });
  if (!pub) return fail("Not found.", 404);
  if (await limited("comment", hashIp(req), user.id, 30, 100)) return fail("You're commenting a lot. Try again in a bit.", 429);
  const b = await body(req);
  const text = str(b?.body, 1000).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (!text) return fail("Write something first.");
  let stepRef: string | null = null, stepLabel: string | null = null;
  const ref = str(b?.step, 140);
  if (ref.includes("|")) {
    const [mapId, stepId] = ref.split("|");
    const step = ((pub.doc as any)?.maps?.[mapId]?.steps || []).find((s: any) => s.id === stepId);
    if (step) { stepRef = ref; stepLabel = String(step.label).slice(0, 160); }
  }
  const c = await prisma.comment.create({ data: { publicId: id, userId: user.id, authorName: user.handle, body: text, stepRef, stepLabel } });
  const count = await prisma.comment.count({ where: { publicId: id } });
  await prisma.publicProcess.update({ where: { id }, data: { commentCount: count } });
  return json({ ok: true, comment: { id: c.id, author: c.authorName, body: c.body, createdAt: c.createdAt.getTime(), stepRef, stepLabel, mine: true }, commentCount: count });
}
