import { prisma } from "./db";
import { saveForUser } from "./agentSave";
import SEED from "./communitySeed.json";

// The community processes: a fixed set, built on by everyone through the chat
// (suggest, validate, vote). There is deliberately no way in the app or the
// agent API to make more; this one-time seed is the only source.
const OWNER_EMAIL = "briandgoldberg@gmail.com";
export const COMMUNITY_AUTHOR = "forks.world community";
let once: Promise<void> | null = null;

export function seedCommunityOnce(origin: string) {
  once ??= (async () => {
    const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true, handle: true } });
    if (!owner) { once = null; return; }
    const have = new Set((await prisma.publicProcess.findMany({ where: { mode: "community" }, select: { title: true } })).map(r => r.title));
    for (const p of SEED as Record<string, any>[]) {
      if (have.has(p.title)) continue;
      // A fixed id per process, so two servers seeding at once can't publish it twice
      const id = "community-" + String(p.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
      const r = await saveForUser(owner, { ...p, id, publish: true }, origin).catch(e => ({ status: 500, body: { error: String(e) } }));
      // Whether this run published it or an earlier, interrupted one did, mark the public version as a community process
      const pub = await prisma.publicProcess.findUnique({ where: { processId: id }, select: { id: true } });
      if (!pub) { console.error("seedCommunity", p.title, r.body); continue; }
      await prisma.publicProcess.update({ where: { id: pub.id }, data: { mode: "community", authorName: COMMUNITY_AUTHOR } });
    }
    // Date them a day before the oldest other public process, so they never show up as the newest
    const oldest = await prisma.publicProcess.findFirst({ where: { mode: { not: "community" } }, orderBy: { publishedAt: "asc" }, select: { publishedAt: true } });
    if (oldest) {
      const t = new Date(oldest.publishedAt.getTime() - 864e5);
      await prisma.publicProcess.updateMany({ where: { mode: "community", publishedAt: { gt: t } }, data: { publishedAt: t } });
    }
  })().catch(e => { console.error("seedCommunity", e); once = null; });
  return once;
}
