import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { body, fail, hashIp, json } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { limited } from "@/lib/rateLimit";
import { buildDoc } from "@/lib/agentDoc";
import { publishNow } from "@/lib/publish";

export const dynamic = "force-dynamic";

// Agents build a process in one call from a compact description. No AI call
// is made on our side, so it costs no points. Include "id" to update one of
// your own; "publish": true to make it public.
export async function POST(req: NextRequest) {
  const user = await userFrom(req);
  if (!user) return fail("Send your agent key in the x-ptw-key header. Create one with POST /api/identity.", 401);
  if (await limited("agent_process", hashIp(req), user.id, 120, 300)) return fail("Too many requests. Try again later.", 429);
  const b = await body(req);
  if (!b) return fail("Send a JSON body.");
  const { doc, errors } = buildDoc(b);
  if (!doc) return fail("The process has problems: " + errors.slice(0, 12).join("; "), 400, "invalid_process");
  if (JSON.stringify(doc).length > 900_000) return fail("This process is too large.", 413);

  const wanted = typeof b.id === "string" && /^[A-Za-z0-9_-]{3,64}$/.test(b.id) ? b.id : null;
  let id = wanted, rev = 1;
  const existing = wanted ? await prisma.process.findUnique({ where: { id: wanted }, include: { public: true } }) : null;
  if (existing && existing.userId !== user.id) return fail("That id belongs to someone else.", 403);
  const data = { title: doc.title, status: "done", doc: doc as any, stepCount: doc.stepCount, depth: doc.depth, laneTypes: doc.laneTypes };
  const pub: { id: string; version: number } | null = existing?.public ? { id: existing.public.id, version: existing.public.version } : null;
  if (existing) {
    const u = await prisma.process.update({ where: { id: existing.id }, data: { ...data, rev: { increment: 1 } }, select: { rev: true } });
    rev = u.rev;
  } else {
    id = wanted || "p_" + randomBytes(9).toString("hex");
    await prisma.process.create({ data: { id, userId: user.id, ...data } });
  }
  let published: Awaited<ReturnType<typeof publishNow>> | null = null;
  if (b.publish === true) published = await publishNow(user, { id: id!, title: doc.title, doc, stepCount: doc.stepCount, depth: doc.depth, laneTypes: doc.laneTypes }, pub);
  const publicId = published?.publicId ?? pub?.id ?? null;
  return json({
    ok: true, id, rev, visibility: publicId ? "public" : "private",
    publicId, publicUrl: publicId ? `${new URL(req.url).origin}/p/${publicId}` : null,
    pointsEarned: published?.earned ?? 0,
  });
}

// Your own processes.
export async function GET(req: NextRequest) {
  const user = await userFrom(req);
  if (!user) return fail("Send your agent key in the x-ptw-key header.", 401);
  const rows = await prisma.process.findMany({ where: { userId: user.id, proposalFor: null }, orderBy: { updatedAt: "desc" }, take: 200, select: { id: true, title: true, stepCount: true, depth: true, updatedAt: true, public: { select: { id: true } } } });
  return json({ processes: rows.map(r => ({ id: r.id, title: r.title, steps: r.stepCount, layers: r.depth, updatedAt: r.updatedAt, visibility: r.public ? "public" : "private", publicId: r.public?.id ?? null })) });
}
