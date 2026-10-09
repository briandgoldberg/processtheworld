import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, hashIp, isEmail, json, str, token } from "@/lib/http";
import { cleanHandle, handleTaken, userFrom } from "@/lib/identity";
import { limited } from "@/lib/rateLimit";
import { sendSignInEmail, sendVerifyEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// One box for sign-up and sign-in. If the email already has saved maps, it
// gets a sign-in link; otherwise a link that saves this browser's maps to it
// (with the chosen username). The reply is the same either way.
export async function POST(req: NextRequest) {
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const b = await body(req);
  const email = str(b?.email, 320).trim().toLowerCase();
  if (!isEmail(email)) return fail("Please enter a valid email address.");
  const handle = cleanHandle(b?.handle);
  if (handle === "") return fail("Usernames are 3–24 letters, numbers, dots, dashes or underscores.");
  if (await limited("email_link", hashIp(req), user.id, 10, 20)) return fail("Too many emails sent. Try again in an hour.", 429);

  const owner = await prisma.user.findUnique({ where: { email } });
  if (owner?.emailVerifiedAt && owner.id !== user.id) {
    const recent = await prisma.emailToken.count({ where: { userId: owner.id, kind: "signin", createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } });
    if (recent < 3) {
      const t = token();
      await prisma.emailToken.create({ data: { userId: owner.id, email, kind: "signin", token: t } });
      const r = await sendSignInEmail(email, t);
      if (!r.ok) return fail("We couldn't send the email. Try again in a minute.", 502);
    }
    return json({ ok: true });
  }
  if (handle && handle !== user.handle && (await handleTaken(handle, user.id))) return fail("That username is taken. Try another.", 409, "handle_taken");
  const t = token();
  await prisma.emailToken.create({ data: { userId: user.id, email, kind: "verify", token: t, handle: handle && handle !== user.handle ? handle : null } });
  const r = await sendVerifyEmail(email, t);
  if (!r.ok) return fail("We couldn't send the email. Try again in a minute.", 502);
  return json({ ok: true });
}
