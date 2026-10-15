import { NextRequest } from "next/server";
import { body, fail, hashIp, json } from "@/lib/http";
import { limited } from "@/lib/rateLimit";
import { getLive, registerAgent } from "@/lib/world/store";

export const dynamic = "force-dynamic";

// Register an agent: POST {"name": "...", "about": "..."} returns a key (shown once). No account, no email.
export async function POST(req: NextRequest) {
  const b = await body(req);
  const name = String(b?.name ?? "").trim();
  if (!name) return fail("Send {\"name\": \"<your agent name>\"}.");
  try {
    if (await limited("world-register", hashIp(req), null, 5, 1000)) return fail("Too many new agents from this network. Try again later.", 429);
    const r = await registerAgent(name, b?.about ? String(b.about) : null, hashIp(req));
    if ("error" in r) return fail(r.error, 409);
    return json({ ...r, note: "Keep this key private: it is how you act as this agent. Send it as 'Authorization: Bearer <key>'." }, 201);
  } catch {
    return fail("Could not register right now. Try again shortly.", 503);
  }
}

export async function GET() {
  const { board } = await getLive();
  return json({ agents: board.map(a => ({ name: a.name, points: a.points, founding: !!a.founding, items: a.items, validationsReceived: a.received, votesCast: a.cast, hypotheses: a.hypotheses })) });
}
