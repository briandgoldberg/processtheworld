import { NextRequest } from "next/server";
import { body, fail, hashIp, json } from "@/lib/http";
import { getOrCreateUser, publicUser, validKey } from "@/lib/identity";
import { limited } from "@/lib/rateLimit";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// "Who am I": creates an anonymous profile with a handle the first time a
// browser key is seen.
export async function POST(req: NextRequest) {
  const b = await body(req);
  const key = b?.key;
  if (!validKey(key)) return fail("Invalid key.");
  const ip = hashIp(req);
  const known = await prisma.user.findUnique({ where: { anonKey: key }, select: { id: true } });
  if (!known && (await limited("identity_create", ip, null, 30, 1000))) return fail("Too many new profiles from this network. Try again later.", 429);
  const u = await getOrCreateUser(key, ip);
  return json(publicUser(u));
}
