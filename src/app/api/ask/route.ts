import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { body, fail, hashIp, json, str } from "@/lib/http";
import { limited } from "@/lib/rateLimit";
import { paths } from "@/lib/world/analysis";
import { search } from "@/lib/world/engine";
import { impactOf } from "@/lib/world/impact";
import { getLive } from "@/lib/world/store";
import type { World } from "@/lib/world/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-opus-5-5";
const MAX_ROUNDS = 8;

const SYSTEM = `You answer questions about how the Earth works using forks.world, a map of Earth's processes where every line between two steps carries a direction, a size and cited papers. You are a careful guide to that map, not a general assistant.

Rules:
- Every causal claim in your answer must come from a line the tools returned. Do not add mechanisms from memory. If the map has no path, say so plainly: that is a gap, and gaps are useful answers.
- Start with search_map to find the steps the question is about, then use impact_of (what one step changes) or paths_between (how one step reaches another). get_step shows one step's lines and sources. Use at most 5 tool calls, then answer; one impact_of or paths_between call usually gives enough.
- Name steps by their labels. Give the direction (raises, lowers) and the size in words (very small to very large) as the lines state them. Where lines carry elasticities, report the composed number; otherwise do not invent numbers.
- Say when a chain is long or rests on a line with little evidence.
- Write 80 to 220 words of plain prose, no headings, no bullet lists, no markdown.
- Your final message must be only a JSON object: {"answer": "<the prose>", "edges": ["<ids of the lines your answer relies on>"], "steps": ["<ids of the steps named>"]}.`;

const tools: Anthropic.Tool[] = [
  { name: "search_map", description: "Find steps, processes and open questions on the map that match words from the question.", input_schema: { type: "object", properties: { q: { type: "string", description: "One to three words, for example 'ocean acidification' or 'snowmelt'." } }, required: ["q"], additionalProperties: false }, strict: true },
  { name: "get_step", description: "One step with its process, the lines coming in and going out (direction, size, note, sources) and links to other processes.", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false }, strict: true },
  { name: "impact_of", description: "Everything downstream of a step within six lines, strongest first, each with the chain of lines that carries the effect.", input_schema: { type: "object", properties: { step: { type: "string", description: "Step id." }, n: { type: "integer", description: "How many effects to return, default 15." } }, required: ["step"], additionalProperties: false }, strict: true },
  { name: "paths_between", description: "Every forward chain of lines from one step to another, shortest first, with the composed sign and the weakest line on each.", input_schema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } }, required: ["from", "to"], additionalProperties: false }, strict: true },
];

type Ents = Awaited<ReturnType<typeof getLive>>["ents"];
function run(w: World, ents: Ents, name: string, input: Record<string, unknown>): unknown {
  const lineOut = (id: string) => { const e = w.edges[id]; if (!e) return null; return { id: e.id, from: e.from, fromLabel: w.steps[e.from]?.label, to: e.to, toLabel: w.steps[e.to]?.label, direction: e.impact.direction, size: e.impact.size, note: e.impact.note, prob: e.prob, elasticity: e.impact.elasticity, loop: e.loop ? e.loop.kind : undefined, hypothesis: !!e.hypothesis, sources: e.evidence.slice(0, 4).map(x => ({ source: x.source, claim: x.claim })) }; };
  if (name === "search_map") { const r = search(w, ents, String(input.q || ""), 8); return { steps: r.steps, processes: r.processes, questions: (r.questions || []).map(q => ({ id: q.id, title: q.title, from: q.from, to: q.to })) }; }
  if (name === "get_step") {
    const s = w.steps[String(input.id || "")]; if (!s || s.status !== "live") return { error: "No such step." };
    const lines = Object.values(w.edges).filter(e => e.status === "live" && (e.from === s.id || e.to === s.id));
    return { id: s.id, label: s.label, kind: s.kind, process: s.process, processTitle: w.processes[s.process]?.title, participants: s.participants, resources: s.resources, subprocess: s.sub, evidence: s.evidence.slice(0, 4).map(x => ({ source: x.source, claim: x.claim })), out: lines.filter(e => e.from === s.id).map(e => lineOut(e.id)), in: lines.filter(e => e.to === s.id).map(e => lineOut(e.id)) };
  }
  if (name === "impact_of") {
    const r = impactOf(w, String(input.step || ""), 6, Math.min(30, Number(input.n) || 15)); if (!r) return { error: "No such step." };
    return { step: r.step, reached: r.reached, effects: r.rows.map(x => ({ step: x.step, label: x.label, process: x.processTitle, sign: x.sign, strength: x.strength, lines: x.hops, elasticity: x.elasticity, chain: x.chain.filter(h => h.edge).map(h => ({ edge: h.edge, from: h.fromLabel, to: h.toLabel, direction: h.dir, size: h.size, prob: h.prob, elasticity: h.elasticity, note: h.note, sources: (h.sources || []).slice(0, 2) })) })) };
  }
  if (name === "paths_between") {
    const from = String(input.from || ""), to = String(input.to || "");
    if (!w.steps[from] || !w.steps[to]) return { error: "Give two step ids." };
    const ps = paths(w, from, to, 8, 8);
    return { from: w.steps[from].label, to: w.steps[to].label, paths: ps.map(p => ({ lines: p.lines, sign: p.sign, elasticity: p.elasticity, hops: p.hops.map(h => ({ step: h.step.label, stepId: h.step.id, edge: h.edge ? { id: h.edge.id, direction: h.edge.impact.direction, size: h.edge.impact.size, note: h.edge.impact.note, elasticity: h.edge.impact.elasticity, confidence: Math.round(h.edge.conf * 100) / 100, sources: h.edge.sources.slice(0, 2) } : undefined })) })) };
  }
  return { error: "Unknown tool." };
}

function parseFinal(text: string): { answer: string; edges: string[]; steps: string[] } {
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { const j = JSON.parse(m[0]); if (typeof j.answer === "string") return { answer: j.answer, edges: Array.isArray(j.edges) ? j.edges.map(String) : [], steps: Array.isArray(j.steps) ? j.steps.map(String) : [] }; } catch { /* fall through */ } }
  return { answer: text.trim(), edges: [], steps: [] };
}

// Ask the map a question. The model may only use lines the graph tools return, so every claim traces to a cited line.
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return fail("Asking is not configured on this deployment.", 503);
  const b = await body(req); if (!b) return fail("Send JSON.");
  const question = str(b.question, 600).trim();
  if (question.length < 8) return fail("Ask a fuller question.");
  const ip = hashIp(req);
  if (await limited("ask", ip, null, 12, 1000)) return fail("Too many questions from this network this hour. Try again later.", 429);
  if (await limited("ask-all", "everyone", null, 150, 1000)) return fail("The site has answered a lot of questions this hour. Try again later.", 429);
  const { world: w, ents } = await getLive();
  // a user-scoped key (sk-ant-usr-…) must name the workspace it bills to; a workspace-scoped key needs no header
  const client = new Anthropic({ defaultHeaders: process.env.ANTHROPIC_WORKSPACE_ID ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID } : undefined });
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];
  const used = new Set<string>(); let inTok = 0, outTok = 0; let finalText = "";
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const res = await client.messages.create({ model: MODEL, max_tokens: 3000, system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }], tools, messages, output_config: { effort: "medium" } });
      inTok += res.usage.input_tokens + (res.usage.cache_read_input_tokens || 0) + (res.usage.cache_creation_input_tokens || 0); outTok += res.usage.output_tokens;
      messages.push({ role: "assistant", content: res.content });
      if (res.stop_reason === "refusal") return fail("The model declined to answer that question.", 400);
      const calls = res.content.filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
      if (res.stop_reason !== "tool_use" || calls.length === 0) { finalText = res.content.filter((c): c is Anthropic.TextBlock => c.type === "text").map(c => c.text).join("\n"); break; }
      const results: Anthropic.ToolResultBlockParam[] = calls.map(c => {
        const input = (c.input && typeof c.input === "object" ? c.input : {}) as Record<string, unknown>;
        const out = run(w, ents, c.name, input);
        const grab = (o: unknown) => { const s = JSON.stringify(o); for (const m of s.matchAll(/"(e_[a-z0-9]+)"/g)) used.add(m[1]); };
        grab(out);
        return { type: "tool_result", tool_use_id: c.id, content: JSON.stringify(out).slice(0, 60000) };
      });
      messages.push({ role: "user", content: results });
    }
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return fail("The model is busy. Try again in a minute.", 503);
    if (e instanceof Anthropic.AuthenticationError) return fail("Asking is misconfigured on this deployment.", 503);
    if (e instanceof Anthropic.BadRequestError && /workspace/i.test(e.message)) return fail("Asking needs a workspace id on this deployment (ANTHROPIC_WORKSPACE_ID).", 503);
    if (e instanceof Anthropic.APIError) return fail(`The model returned an error (${e.status}).`, 502);
    throw e;
  }
  // out of tool rounds: ask for the answer from what was gathered, with no more tools
  if (!finalText) {
    try {
      messages.push({ role: "user", content: "Stop using tools. Answer now from the lines already returned, and say what the map lacks. Reply with the JSON object only." });
      const res = await client.messages.create({ model: MODEL, max_tokens: 2000, system: SYSTEM, messages, output_config: { effort: "low" } });
      inTok += res.usage.input_tokens; outTok += res.usage.output_tokens;
      finalText = res.content.filter((c): c is Anthropic.TextBlock => c.type === "text").map(c => c.text).join("\n");
    } catch { /* reported below */ }
  }
  if (!finalText) return fail("The model ran out of steps before answering. Try a narrower question.", 504);
  const f = parseFinal(finalText);
  const edgeIds = (f.edges.length ? f.edges : [...used]).filter(id => w.edges[id]).slice(0, 12);
  const lines = edgeIds.map(id => { const e = w.edges[id]; const A = w.steps[e.from], B = w.steps[e.to]; return { id, from: { id: e.from, label: A?.label || e.from, process: A?.process || "" }, to: { id: e.to, label: B?.label || e.to, process: B?.process || "" }, direction: e.impact.direction, size: e.impact.size, note: e.impact.note, elasticity: e.impact.elasticity, hypothesis: !!e.hypothesis, sources: e.evidence.map(x => x.source).slice(0, 4) }; });
  const cost = Math.round((inTok * 4 + outTok * 20) / 1e6 * 1000) / 1000;
  return json({ answer: f.answer, lines, usage: { input: inTok, output: outTok, usd: cost } });
}
