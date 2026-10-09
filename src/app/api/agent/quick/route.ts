import { NextRequest } from "next/server";
import { fail, hashIp, json } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { limited } from "@/lib/rateLimit";
import { saveForUser } from "@/lib/agentSave";
import { newGuest } from "@/lib/guest";

export const dynamic = "force-dynamic";

// The simplest way for an AI that can only open links (or make one request):
// sign up as a guest, save the process, and publish it, all in one call.
//   GET  /api/agent/quick?json=<url-encoded process JSON>        (or ?b64=<base64url of the JSON>)
//   POST /api/agent/quick   with the process JSON as the body
// Publishes by default; add publish=false (GET) or "publish": false (POST) to keep it private.
// Send x-ptw-key to use an existing account instead of making a new guest.
async function run(req: NextRequest, input: Record<string, any> | null, publishDefault: boolean) {
  if (!input || typeof input !== "object") return fail("Send the process as JSON: ?json=<url-encoded JSON>, ?b64=<base64url JSON>, or a POST body.");
  let user = await userFrom(req), key: string | null = null;
  if (!user) {
    const g = await newGuest(req);
    if (!g) return fail("Too many new guests from this network. Try again later.", 429);
    user = g.user; key = g.key;
  }
  if (await limited("agent_process", hashIp(req), user.id, 120, 300)) return fail("Too many requests. Try again later.", 429);
  const r = await saveForUser(user, { ...input, publish: input.publish === undefined ? publishDefault : input.publish === true }, new URL(req.url).origin);
  return json({ ...r.body, handle: user.handle, ...(key ? { key, note: "Keep this key to update the process later (send it as x-ptw-key)." } : {}) }, r.status);
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  let input: Record<string, any> | null = null;
  try {
    if (q.get("b64")) input = JSON.parse(Buffer.from(q.get("b64")!, "base64url").toString("utf8"));
    else if (q.get("json")) input = JSON.parse(q.get("json")!);
  } catch {
    return fail("That JSON could not be read. URL-encode it, or send it base64url-encoded as ?b64=.");
  }
  if (input && q.get("publish") === "false") input.publish = false;
  return run(req, input, true);
}

export async function POST(req: NextRequest) {
  let input: Record<string, any> | null = null;
  try { input = await req.json(); } catch { /* handled in run */ }
  return run(req, input, true);
}
