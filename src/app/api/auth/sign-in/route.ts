import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, hashIp, isEmail, json, str, token } from "@/lib/http";
import { limited } from "@/lib/rateLimit";
import { sendSignInEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Step one of signing in on a new device. The answer is the same whether or
// not the email has a profile, so it can't be used to check who has one.
export async function POST(req: NextRequest) {
  const b = await body(req);
  const email = str(b?.email, 320).trim().toLowerCase();
  if (!isEmail(email)) return fail("Please enter a valid email address.");
  if (await limited("sign_in", hashIp(req), null, 10, 1000)) return fail("Too many sign-in emails. Try again in an hour.", 429);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.emailVerifiedAt) {
    const recent = await prisma.emailToken.count({ where: { userId: user.id, kind: "signin", createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } });
    if (recent < 3) {
      const t = token();
      await prisma.emailToken.create({ data: { userId: user.id, email, kind: "signin", token: t } });
      const r = await sendSignInEmail(email, t);
      if (!r.ok) console.error("sign-in email failed", r.error);
    }
  }
  return json({ ok: true });
}
