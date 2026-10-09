import { prisma } from "./db";

// Handles celebrate exploring and inventing, e.g. "BoldPathfinder42".
const ADJECTIVES = ["Bold","Brave","Bright","Clever","Curious","Daring","Eager","Fearless","Intrepid","Inventive","Keen","Nimble","Plucky","Quick","Restless","Roaming","Spirited","Steady","Swift","Tireless","Trusty","Valiant","Visionary","Wandering","Wild"];
const NOUNS = ["Adventurer","Builder","Cartographer","Discoverer","Explorer","Founder","Innovator","Inventor","Mapmaker","Maker","Navigator","Pathfinder","Pioneer","Ranger","Scout","Seeker","Tinkerer","Trailblazer","Traveler","Voyager","Wayfinder"];
// Handles from the first naming scheme (animals); anonymous profiles still on one get a new handle.
const LEGACY = /^(Amber|Brisk|Cedar|Copper|Dusty|Ember|Fern|Golden|Hazel|Indigo|Jade|Kindly|Lunar|Maple|Nimble|Olive|Plucky|Quiet|Rusty|Sunny|Tidy|Umber|Velvet|Willow|Zesty)(Otter|Heron|Falcon|Badger|Lynx|Marten|Wren|Beaver|Fox|Owl|Hare|Finch|Puffin|Ibex|Koala|Lark|Moose|Newt|Panda|Robin|Seal|Tern|Vole|Yak|Zebra)\d+$/;

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
    if (LEGACY.test(existing.handle)) {
      return prisma.user.update({ where: { id: existing.id }, data: { handle: await freshHandle(), lastSeenAt: new Date() } });
    }
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

// The admin dashboard belongs to one person. Deliberately not configurable,
// so nobody with access to the hosting settings can add themselves.
const ADMIN_EMAIL = "briandgoldberg@gmail.com";
export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === ADMIN_EMAIL;
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
