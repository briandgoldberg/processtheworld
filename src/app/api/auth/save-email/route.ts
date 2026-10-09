import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, hashIp, isEmail, json, str, token } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { limited } from "@/lib/rateLimit";
import { sendVerifyEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// "Save my maps": email a confirmation link. Optional; nobody has to do this to map.
export async function POST(req: NextRequest) {
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const b = await body(req);
  const email = str(b?.email, 320).trim().toLowerCase();
  if (!isEmail(email)) return fail("Please enter a valid email address.");
  if (await limited("save_email", hashIp(req), user.id, 10, 10)) return fail("Too many emails sent. Try again in an hour.", 429);
  const owner = await prisma.user.findUnique({ where: { email } });
  if (owner && owner.id !== user.id && owner.emailVerifiedAt) return fail("That email already has saved maps. Use “Sign in” instead.", 409, "email_taken");
  const t = token();
  await prisma.emailToken.create({ data: { userId: user.id, email, kind: "verify", token: t } });
  const r = await sendVerifyEmail(email, t);
  if (!r.ok) return fail("We couldn't send the email. Try again in a minute.", 502);
  return json({ ok: true });
}
