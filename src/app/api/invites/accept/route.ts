import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, hashIp, json, str, token as newToken } from "@/lib/http";
import { cleanHandle, getOrCreateUser, handleTaken, publicUser, validKey } from "@/lib/identity";

export const dynamic = "force-dynamic";

// Accepting an email invite. Clicking the emailed link proves the address, so:
// - if that email already has an account, this browser signs in to it;
// - otherwise this browser's profile becomes that account (signed up), or a
//   new one if this browser is signed in as someone else.
// Either way the shared process lands in "Shared with me".
export async function POST(req: NextRequest) {
  const b = await body(req);
  const t = str(b?.token, 200);
  const share = t ? await prisma.share.findUnique({ where: { token: t } }) : null;
  if (!share || share.acceptedAt || !share.email) return fail("This invite was already used or doesn't exist.");
  const email = share.email;
  const handle = cleanHandle(b?.handle);
  if (handle === "") return fail("Usernames are 3–24 letters, numbers, dots, dashes or underscores.");

  let target = await prisma.user.findFirst({ where: { email, emailVerifiedAt: { not: null } } });
  if (!target) {
    const current = validKey(b?.oldKey) ? await prisma.user.findUnique({ where: { anonKey: b!.oldKey as string } }) : null;
    let base = current && !current.emailVerifiedAt ? current : null;
    if (!base) base = await getOrCreateUser(newToken().slice(0, 36), hashIp(req));
    if (handle && (await handleTaken(handle, base.id))) return fail("That username is taken. Try another.", 409);
    await prisma.user.updateMany({ where: { email, id: { not: base.id } }, data: { email: null } });
    target = await prisma.user.update({ where: { id: base.id }, data: { email, emailVerifiedAt: new Date(), ...(handle ? { handle } : {}) } });
  }
  const dupe = await prisma.share.findFirst({ where: { processId: share.processId, userId: target.id } });
  if (dupe) await prisma.share.delete({ where: { id: share.id } });
  else await prisma.share.update({ where: { id: share.id }, data: { userId: target.id, acceptedAt: new Date(), token: null } });
  return json({ ok: true, key: target.anonKey, processId: share.processId, ...publicUser(target) });
}
