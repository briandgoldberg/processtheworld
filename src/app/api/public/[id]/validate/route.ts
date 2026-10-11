import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, hashIp, json, str } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { limited } from "@/lib/rateLimit";
import { earnCredits } from "@/lib/points";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

// Validating a community process: "this matches my experience" (ok: true) or
// "something's off" (ok: false, with what's different). A confirmation is
// counted, and credited, once per person per version.
const refOf = (id: string, version: number) => `${id}:v${version}`;

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const pub = await prisma.publicProcess.findUnique({ where: { id }, select: { version: true, mode: true } });
  if (!pub || pub.mode !== "community") return json({ confirmations: 0, mine: false });
  const user = await userFrom(req);
  const ref = refOf(id, pub.version);
  const [confirmations, mine] = await Promise.all([
    prisma.pointEvent.count({ where: { reason: "validate", refId: ref } }),
    user ? prisma.pointEvent.count({ where: { reason: "validate", refId: ref, userId: user.id } }) : 0,
  ]);
  return json({ confirmations, mine: mine > 0, version: pub.version });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const pub = await prisma.publicProcess.findUnique({ where: { id }, select: { version: true, mode: true } });
  if (!pub) return fail("Not found.", 404);
  if (pub.mode !== "community") return fail("Only community processes are validated.", 403);
  if (await limited("validate", hashIp(req), user.id, 60, 200)) return fail("Too many at once. Try again later.", 429);
  const b = await body(req);
  const ok = b?.ok !== false;
  const note = str(b?.note, 500).trim();
  await prisma.event.create({ data: { userId: user.id, who: "human", type: ok ? "validated" : "flagged", data: { publicId: id, version: pub.version, ...(note ? { note } : {}) } } });
  const ref = refOf(id, pub.version);
  const earned = ok ? await earnCredits(user.id, "validate", ref) : 0;
  const confirmations = await prisma.pointEvent.count({ where: { reason: "validate", refId: ref } });
  return json({ ok: true, earned, confirmations, version: pub.version });
}
