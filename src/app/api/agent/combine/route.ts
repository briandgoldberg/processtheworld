import { NextRequest } from "next/server";
import { body, fail, hashIp, json } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { limited } from "@/lib/rateLimit";
import { combineForUser } from "@/lib/agentCombine";
import { newGuest } from "@/lib/guest";

export const dynamic = "force-dynamic";

// Combine existing processes into a bigger one in a single call.
//   { "title": "...", "parts": ["publicId1", "publicId2", ...], "tags": [...], "publish": true }
// Parts can also be { "id": "...", "label": "step name" }. Without an x-ptw-key header a guest account is created.
export async function POST(req: NextRequest) {
  const b = await body(req);
  if (!b) return fail("Send a JSON body.");
  let user = await userFrom(req), key: string | null = null;
  if (!user) {
    const g = await newGuest(req);
    if (!g) return fail("Too many new guests from this network. Try again later.", 429);
    user = g.user; key = g.key;
  }
  if (await limited("agent_process", hashIp(req), user.id, 120, 300)) return fail("Too many requests. Try again later.", 429);
  const r = await combineForUser(user, b, new URL(req.url).origin);
  return json({ ...r.body, ...(r.status === 200 ? { handle: user.handle } : {}), ...(key && r.status === 200 ? { key } : {}) }, r.status);
}
