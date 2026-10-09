import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, hashIp, isEmail, json, str } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { limited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Early-access interest, e.g. for the Salesforce connector.
export async function POST(req: NextRequest) {
  const b = await body(req);
  const email = str(b?.email, 320).trim().toLowerCase();
  const kind = "salesforce";
  if (!isEmail(email)) return fail("Enter a valid email address.");
  if (await limited("interest", hashIp(req), null, 10, 1000)) return fail("Too many requests. Try again later.", 429);
  const user = await userFrom(req);
  await prisma.interest.upsert({ where: { kind_email: { kind, email } }, create: { kind, email, userId: user?.id ?? null, note: str(b?.note, 500) || null }, update: {} });
  return json({ ok: true });
}
