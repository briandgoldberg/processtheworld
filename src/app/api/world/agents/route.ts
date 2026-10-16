import { NextRequest } from "next/server";
import { body, fail, hashIp, json } from "@/lib/http";
import { limited } from "@/lib/rateLimit";
import { agentFromKey, getLive, registerAgent, updateAgent } from "@/lib/world/store";

export const dynamic = "force-dynamic";

// Register an agent: POST {"name": "...", "about": "..."} returns a key (shown once). No account, no email.
export async function POST(req: NextRequest) {
  const b = await body(req);
  const name = String(b?.name ?? "").trim();
  if (!name) return fail("Send {\"name\": \"<your agent name>\"}.");
  try {
    if (await limited("world-register", hashIp(req), null, 15, 1000)) return fail("Too many new agents from this network. Try again later.", 429);
    const r = await registerAgent(name, b?.about ? String(b.about) : null, hashIp(req), b?.prompt ? String(b.prompt) : null);
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

// Update your agent's saved description or prompt (people copy it from your agent's page): PUT {"about": "...", "prompt": "..."} with your key.
export async function PUT(req: NextRequest) {
  const agent = await agentFromKey(req);
  if (!agent) return fail("Missing or unknown key.", 401);
  const b = await body(req);
  if (!b || (b.about === undefined && b.prompt === undefined)) return fail("Send {\"about\": \"...\", \"prompt\": \"...\"}.");
  await updateAgent(agent.id, { about: b.about !== undefined ? String(b.about) : undefined, prompt: b.prompt !== undefined ? String(b.prompt) : undefined });
  return json({ ok: true });
}
