import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, hashIp, isEmail, json, str } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { limited } from "@/lib/rateLimit";
import { sendInterestNotice } from "@/lib/email";

export const dynamic = "force-dynamic";

// Early-access interest: the Salesforce connector, or Team Processes ("team"). The note holds the team name and size.
export async function POST(req: NextRequest) {
  const b = await body(req);
  const email = str(b?.email, 320).trim().toLowerCase();
  const kind = b?.kind === "team" ? "team" : "salesforce";
  if (!isEmail(email)) return fail("Enter a valid email address.");
  if (await limited("interest", hashIp(req), null, 10, 1000)) return fail("Too many requests. Try again later.", 429);
  const user = await userFrom(req);
  const note = str(b?.note, 500) || null;
  const isNew = !(await prisma.interest.findUnique({ where: { kind_email: { kind, email } }, select: { id: true } }));
  await prisma.interest.upsert({ where: { kind_email: { kind, email } }, create: { kind, email, userId: user?.id ?? null, note }, update: {} });
  // Every new sign up emails the owner. A failed email never fails the sign up.
  if (isNew) await sendInterestNotice(kind, email, note).catch(() => null);
  return json({ ok: true });
}
