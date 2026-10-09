import { prisma } from "./db";
import { cleanTags } from "./tags";

type Proc = { id: string; title: string; doc: any; stepCount: number; depth: number; laneTypes: string[] };

/** Publish a process as is (first time), or push the creator's latest edits to the public version. */
export async function publishNow(user: { id: string; handle: string }, p: Proc, existing: { id: string; version: number } | null) {
  const tags = cleanTags(p.doc.tags);
  const snapshot = { title: p.title, maps: p.doc.maps, tags, status: p.doc.status || "interviewing", chat: [], events: [] };
  if (!existing) {
    const pub = await prisma.publicProcess.create({ data: { processId: p.id, userId: user.id, title: p.title, doc: snapshot as any, stepCount: p.stepCount, depth: p.depth, laneTypes: p.laneTypes, authorName: user.handle, mode: "locked", tags } });
    await prisma.publicVersion.create({ data: { publicId: pub.id, version: 1, title: p.title, doc: snapshot as any } });
    return { publicId: pub.id, published: true };
  }
  const v = existing.version + 1;
  await prisma.$transaction([
    prisma.publicProcess.update({ where: { id: existing.id }, data: { doc: snapshot as any, title: p.title, version: v, stepCount: p.stepCount, depth: p.depth, laneTypes: p.laneTypes, tags } }),
    prisma.publicVersion.create({ data: { publicId: existing.id, version: v, title: p.title, doc: snapshot as any } }),
  ]);
  return { publicId: existing.id, updated: true };
}
