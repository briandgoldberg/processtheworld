import { Resend } from "resend";

const FROM = () => process.env.EMAIL_FROM || "forks.world <hello@waitingforpower.com>";
export const appUrl = () => (process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL : "http://localhost:3000")).replace(/\/$/, "");

async function send(to: string, subject: string, lead: string, label: string, url: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set; cannot send email.");
    return { ok: false as const, error: "not_configured" };
  }
  const html = `<p>${lead}</p><p><a href="${url}">${label}</a></p><p style="color:#666;font-size:13px;">If you didn't ask for this, you can ignore this email.</p>`;
  const text = `${lead}\n\n${url}\n\nIf you didn't ask for this, you can ignore this email.`;
  const { error } = await new Resend(apiKey).emails.send({ from: FROM(), to, subject, html, text });
  if (error) {
    console.error("Resend error:", error);
    return { ok: false as const, error: error.message };
  }
  return { ok: true as const };
}

export const sendVerifyEmail = (to: string, token: string) =>
  send(to, "Save your processes on forks.world", "Confirm your email to keep your processes on any device. No password, just this link.", "Save my processes", `${appUrl()}/api/auth/verify?token=${token}`);

export const sendSignInEmail = (to: string, token: string) =>
  send(to, "Sign in to forks.world", "Use this link to sign in and get your processes back. It works once and expires in 30 minutes.", "Sign in", `${appUrl()}/restore?token=${token}`);

export const sendInviteEmail = (to: string, inviter: string, title: string, token: string) =>
  send(to, `${inviter} shared “${title}” with you`, `${inviter} invited you to work on the process “${title}” on forks.world. Accepting creates your account; no password needed.`, "Accept the invite", `${appUrl()}/invite?token=${token}`);

export const sendShareNotice = (to: string, inviter: string, title: string) =>
  send(to, `${inviter} shared “${title}” with you`, `${inviter} shared the process “${title}” with you on forks.world. You'll find it under “Shared with me”.`, "Open forks.world", `${appUrl()}/`);
