import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, hashIp, isEmail, json, str } from "@/lib/http";
import { limited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Feedback needs an email address. It is saved, then emailed to the site owner if an email service is configured:
//   RESEND_API_KEY   the sending key
//   FEEDBACK_TO      where to send it
//   FEEDBACK_FROM    optional sender, e.g. "Forks.World <feedback@yourdomain.com>"
async function emailOwner(email: string, message: string, page: string) {
  const key = process.env.RESEND_API_KEY, to = process.env.FEEDBACK_TO;
  if (!key || !to) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.FEEDBACK_FROM || "Forks.World <onboarding@resend.dev>",
        to: [to],
        reply_to: email,
        subject: `Forks.World feedback from ${email}`,
        text: `${message}\n\n---\nFrom: ${email}\nPage: ${page || "unknown"}`,
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const b = await body(req);
  if (!b) return fail("Send JSON with email and message.");
  if (b.website) return json({ ok: true }); // a hidden field only bots fill in
  const email = str(b.email, 320).trim();
  const message = str(b.message, 3000).trim();
  const page = str(b.page, 300);
  if (!isEmail(email)) return fail("Please enter a valid email address so we can reply.");
  if (message.length < 3) return fail("Please write your feedback.");
  try {
    if (await limited("feedback", hashIp(req), null, 6, 1000)) return fail("Too many messages from this network. Try again later.", 429);
    const row = await prisma.wFeedback.create({ data: { email, message, page, ipHash: hashIp(req) } });
    if (await emailOwner(email, message, page)) await prisma.wFeedback.update({ where: { id: row.id }, data: { emailed: true } });
    return json({ ok: true });
  } catch {
    return fail("Could not send right now. Please try again in a moment.", 503);
  }
}
