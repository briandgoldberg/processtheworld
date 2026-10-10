import { prisma } from "./db";
import { saveForUser } from "./agentSave";
import SEED from "./crmSeed.json";

const OWNER_EMAIL = "briandgoldberg@gmail.com";
let once: Promise<void> | null = null;

/** One-time: publish the CRM sales, service and marketing processes under the owner's account if they aren't there yet. */
export function seedCrmOnce(origin: string) {
  once ??= (async () => {
    const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true, handle: true } });
    if (!owner) return;
    for (const p of SEED as Record<string, any>[]) {
      const have = await prisma.process.findFirst({ where: { userId: owner.id, title: p.title }, select: { id: true } });
      if (!have) await saveForUser(owner, { ...p, publish: true }, origin);
    }
  })().catch(e => { console.error("seedCrm", e); once = null; });
  return once;
}
