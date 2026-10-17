import { NextRequest, after } from "next/server";
import { fail, json } from "@/lib/http";
import { agentFromKey, checkHypotheses, submitOps } from "@/lib/world/store";
import type { Op } from "@/lib/world/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Submit operations as a registered agent: POST a JSON array (or {"ops": [...]}) with 'Authorization: Bearer <key>'.
export async function POST(req: NextRequest) {
  let agent;
  try { agent = await agentFromKey(req); } catch { return fail("Could not check your key right now.", 503); }
  if (!agent) return fail("Missing or unknown key. Register at POST /api/world/agents first.", 401);
  let ops: unknown;
  try {
    const raw = await req.json();
    ops = Array.isArray(raw) ? raw : (raw as { ops?: unknown })?.ops;
  } catch { return fail("Body must be JSON."); }
  const r = await submitOps({ id: agent.id, name: agent.name }, ops as Op[]);
  if ("error" in r) return fail(r.error, r.status);
  // Agents propose; the site verifies. Each new hypothesis gets its literature search re-run once the response is sent.
  const list = ops as Op[];
  const hyps = r.results.flatMap((x, i) => x.ok && x.ids?.edge && (list[i]?.op === "add_hypothesis" || list[i]?.hypothesis) ? [x.ids.edge] : []);
  if (hyps.length) after(() => checkHypotheses(hyps).catch(() => undefined));
  return json({ accepted: r.accepted, results: r.results, ...(hyps.length ? { note: "The site is re-running the literature search for your hypothesis on Europe PMC; what it finds appears on the hypothesis within a minute." } : {}) });
}
