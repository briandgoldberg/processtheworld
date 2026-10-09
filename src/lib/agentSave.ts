import { randomBytes } from "crypto";
import { prisma } from "./db";
import { buildDoc } from "./agentDoc";
import { publishNow } from "./publish";

type Result = { status: number; body: Record<string, unknown> };

/** Save (or update) a process for a user from the compact agent format, optionally publishing it. */
export async function saveForUser(user: { id: string; handle: string }, b: Record<string, any>, origin: string): Promise<Result> {
  const { doc, errors } = buildDoc(b);
  if (!doc) return { status: 400, body: { error: "The process has problems: " + errors.slice(0, 12).join("; "), code: "invalid_process" } };
  // Steps that link to another published process: check it exists and remember its title.
  const linked: any[] = Object.values(doc.maps as Record<string, any>).flatMap((m: any) => m.steps.filter((s: any) => s.link));
  if (linked.length) {
    const found = await prisma.publicProcess.findMany({ where: { id: { in: [...new Set(linked.map((s: any) => s.link.id))] } }, select: { id: true, title: true } });
    const titles = new Map(found.map(f => [f.id, f.title]));
    const missing = linked.filter((s: any) => !titles.has(s.link.id));
    if (missing.length) return { status: 400, body: { error: "The process has problems: step \"" + missing[0].id + "\" links to a published process that doesn't exist (" + missing[0].link.id + ")", code: "invalid_process" } };
    linked.forEach((s: any) => { s.link.title = titles.get(s.link.id); });
  }
  if (JSON.stringify(doc).length > 900_000) return { status: 413, body: { error: "This process is too large." } };

  const wanted = typeof b.id === "string" && /^[A-Za-z0-9_-]{3,64}$/.test(b.id) ? b.id : null;
  let id = wanted, rev = 1;
  const existing = wanted ? await prisma.process.findUnique({ where: { id: wanted }, include: { public: true } }) : null;
  if (existing && existing.userId !== user.id) return { status: 403, body: { error: "That id belongs to someone else." } };
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
  return {
    status: 200,
    body: {
      ok: true, id, rev, visibility: publicId ? "public" : "private",
      publicId, publicUrl: publicId ? `${origin}/p/${publicId}` : null,
      flowUrl: publicId ? `${origin}/api/public/${publicId}/export?format=html` : null,
    },
  };
}
