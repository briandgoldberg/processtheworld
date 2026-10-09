import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, json, str } from "@/lib/http";
import { publicUser, validKey } from "@/lib/identity";

export const dynamic = "force-dynamic";

const LIFETIME_MS = 30 * 60 * 1000;

// Step two: trade a single-use sign-in token for the profile's key. Called
// when the person clicks Continue, so link scanners can't use up the token.
// Maps made anonymously on this device move into the signed-in profile.
export async function POST(req: NextRequest) {
  const b = await body(req);
  const t = str(b?.token, 200).trim();
  if (!t) return fail("Invalid link.");
  const claimed = await prisma.emailToken.updateMany({
    where: { token: t, kind: "signin", usedAt: null, createdAt: { gte: new Date(Date.now() - LIFETIME_MS) } },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return fail("That link expired or was already used. Request a new one.");
  const row = await prisma.emailToken.findUnique({ where: { token: t }, include: { user: true } });
  if (!row) return fail("That profile can't be restored.");
  const target = row.user;

  const oldKey = b?.oldKey;
  let moved = 0;
  if (validKey(oldKey) && oldKey !== target.anonKey) {
    const old = await prisma.user.findUnique({ where: { anonKey: oldKey } });
    if (old && !old.emailVerifiedAt && old.id !== target.id) {
      const where = { userId: old.id };
      const r = await prisma.process.updateMany({ where, data: { userId: target.id } });
      moved = r.count;
      await prisma.$transaction([
        prisma.turn.updateMany({ where, data: { userId: target.id } }),
        prisma.event.updateMany({ where, data: { userId: target.id } }),
        prisma.feedback.updateMany({ where, data: { userId: target.id } }),
        prisma.aiCall.updateMany({ where, data: { userId: target.id } }),
      ]);
    }
  }
  return json({ ok: true, key: target.anonKey, moved, ...publicUser(target) });
}
