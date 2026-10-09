import { prisma } from "./db";

const ADJECTIVES = ["Amber","Brisk","Cedar","Copper","Dusty","Ember","Fern","Golden","Hazel","Indigo","Jade","Kindly","Lunar","Maple","Nimble","Olive","Plucky","Quiet","Rusty","Sunny","Tidy","Umber","Velvet","Willow","Zesty"];
const NOUNS = ["Otter","Heron","Falcon","Badger","Lynx","Marten","Wren","Beaver","Fox","Owl","Hare","Finch","Puffin","Ibex","Koala","Lark","Moose","Newt","Panda","Robin","Seal","Tern","Vole","Yak","Zebra"];

async function freshHandle(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const h = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)] + NOUNS[Math.floor(Math.random() * NOUNS.length)] + (10 + Math.floor(Math.random() * 90));
    if (!(await prisma.user.findUnique({ where: { handle: h }, select: { id: true } }))) return h;
  }
  return "Mapper" + Date.now().toString(36);
}

export const validKey = (k: unknown): k is string => typeof k === "string" && k.length >= 16 && k.length <= 200;

export async function getOrCreateUser(anonKey: string, ipHash: string | null) {
  const existing = await prisma.user.findUnique({ where: { anonKey } });
  if (existing) {
    if (Date.now() - existing.lastSeenAt.getTime() > 10 * 60 * 1000) {
      await prisma.user.update({ where: { id: existing.id }, data: { lastSeenAt: new Date() } });
    }
    return existing;
  }
  return prisma.user.create({ data: { anonKey, handle: await freshHandle(), firstIpHash: ipHash } });
}

// Every request after the first identifies itself with the browser key.
export async function userFrom(req: Request) {
  const key = req.headers.get("x-ptw-key");
  if (!validKey(key)) return null;
  return prisma.user.findUnique({ where: { anonKey: key } });
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS || "briandgoldberg@gmail.com").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function adminFrom(req: Request) {
  const u = await userFrom(req);
  return u && u.emailVerifiedAt && isAdminEmail(u.email) ? u : null;
}

export const publicUser = (u: { handle: string; email: string | null; emailVerifiedAt: Date | null }) => ({
  handle: u.handle,
  email: u.emailVerifiedAt ? u.email : null,
  isAdmin: !!u.emailVerifiedAt && isAdminEmail(u.email),
});
