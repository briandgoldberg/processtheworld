// Loads the live map (founding snapshot + every agent operation in the database) and records new operations.
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import seed from "./seed.json";
import { MAX_BATCH, applyOp, entities, leaderboard, newCtx, resolve, score, type Entity, type AgentRow } from "./engine";
import type { Op, OpResult, World } from "./types";

export type Live = { world: World; ents: Entity[]; board: AgentRow[]; opCount: number; dbOk: boolean; builtAt: number };
let cache: Live | null = null;
const TTL = 20_000;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const newKey = () => "fw_" + randomBytes(24).toString("hex");

const FOUNDING = new Set(Object.keys((seed as unknown as World).agents));

async function build(): Promise<Live> {
  const world = structuredClone(seed) as unknown as World;
  world.likes ||= [];
  for (const a of Object.values(world.agents)) a.founding = true;
  let opCount = 0, dbOk = true;
  try {
    // Agents named SmokeTest... are used to test the live write path and are kept off the site
    const agents = (await prisma.wAgent.findMany()).filter(a => !a.name.startsWith("SmokeTest"));
    const byId = new Map(agents.map(a => [a.id, a]));
    for (const a of agents) world.agents[a.name] ||= { name: a.name, points: 0, about: a.about || undefined, strategy: a.prompt || undefined, joinedAt: a.createdAt.getTime(), alive: true };
    const ops = await prisma.wOp.findMany({ orderBy: { createdAt: "asc" } });
    for (const o of ops) {
      const a = byId.get(o.agentId); if (!a) continue;
      const result = (o.result as { ids?: Record<string, string> } | null) || {};
      applyOp(world, a.name, o.payload as Op, newCtx(o.createdAt.getTime(), result.ids, true));
      opCount++;
    }
  } catch {
    dbOk = false; // the database is unreachable or not set up yet: show the founding map
  }
  resolve(world);
  score(world);
  return { world, ents: entities(world), board: leaderboard(world), opCount, dbOk, builtAt: Date.now() };
}

export async function getLive(fresh = false): Promise<Live> {
  if (!fresh && cache && Date.now() - cache.builtAt < TTL) return cache;
  cache = await build();
  return cache;
}
export const invalidate = () => { cache = null; };

export const validName = (n: string) => /^[A-Za-z][A-Za-z0-9_-]{2,29}$/.test(n);

export async function registerAgent(name: string, about: string | null, ipHash: string | null, prompt: string | null = null): Promise<{ error: string } | { name: string; key: string }> {
  if (!validName(name)) return { error: "Name must be 3-30 characters: letters, digits, - or _, starting with a letter." };
  if ([...FOUNDING].some(f => f.toLowerCase() === name.toLowerCase())) return { error: "That name belongs to a founding agent. Pick another." };
  if (await prisma.wAgent.findUnique({ where: { nameLower: name.toLowerCase() } })) return { error: "That name is taken." };
  const key = newKey();
  await prisma.wAgent.create({ data: { name, nameLower: name.toLowerCase(), keyHash: sha(key), about: about ? about.slice(0, 280) : null, prompt: prompt ? prompt.slice(0, 6000) : null, ipHash } });
  invalidate();
  return { name, key };
}

export async function agentFromKey(req: Request) {
  const h = req.headers.get("authorization") || "";
  const key = h.startsWith("Bearer ") ? h.slice(7).trim() : new URL(req.url).searchParams.get("key") || "";
  if (key.length < 20 || key.length > 200) return null;
  const a = await prisma.wAgent.findUnique({ where: { keyHash: sha(key) } });
  if (a && Date.now() - a.lastSeenAt.getTime() > 5 * 60_000) await prisma.wAgent.update({ where: { id: a.id }, data: { lastSeenAt: new Date() } });
  return a;
}

// Op fields that can name a step, process or other item by "@ref".
const REF_FIELDS = ["from", "to", "process", "target", "from_step", "to_step", "from_id", "to_id", "source_step", "target_step", "src", "dst"];
function resolveRefs(op: Op, refs: Record<string, string>): Op {
  const x = { ...(op as unknown as Record<string, unknown>) };
  for (const k of REF_FIELDS) {
    const v = x[k];
    if (typeof v === "string" && v[0] === "@" && refs[v.slice(1)]) x[k] = refs[v.slice(1)];
  }
  return x as unknown as Op;
}

export const HOURLY_OPS = 500;

/** Apply a batch of operations for an agent against the current map, and store the ones that pass. */
export async function submitOps(agent: { id: string; name: string }, ops: Op[]): Promise<{ results: OpResult[]; accepted: number } | { error: string; status: number }> {
  if (!Array.isArray(ops) || !ops.length) return { error: "Send a JSON array of operations.", status: 400 };
  if (ops.length > MAX_BATCH) return { error: `At most ${MAX_BATCH} operations per request.`, status: 400 };
  const since = new Date(Date.now() - 3600_000);
  const recent = await prisma.wOp.count({ where: { agentId: agent.id, createdAt: { gte: since } } });
  if (recent + ops.length > HOURLY_OPS) return { error: `Rate limit: ${HOURLY_OPS} operations per hour per agent.`, status: 429 };
  const { world } = await getLive(true);
  const results: OpResult[] = [];
  let accepted = 0;
  // "@name" references to steps added earlier in this request. Each op gets its own ctx (so replay
  // from the log stays one op at a time), so resolve references to real ids here and store the
  // resolved payload; otherwise a line to a step added in the same request would always fail.
  const refs: Record<string, string> = {};
  for (const op0 of ops) {
    if (!op0 || typeof op0 !== "object" || typeof op0.op !== "string") { results.push({ ok: false, error: "each operation needs an op field" }); continue; }
    if (JSON.stringify(op0).length > 8000) { results.push({ ok: false, error: "operation too large" }); continue; }
    const op = resolveRefs(op0, refs);
    const ctx = newCtx(Date.now());
    const r = applyOp(world, agent.name, op, ctx);
    if (!r.ok) { results.push(r); continue; }
    Object.assign(refs, ctx.refs);
    const target = typeof op.target === "string" ? op.target : "";
    const uniq = op.op === "vote" || op.op === "like" ? `${op.op}:${agent.id}:${target}` : null;
    try {
      await prisma.wOp.create({ data: { agentId: agent.id, kind: op.op, payload: op as object, result: { ids: ctx.ids }, uniq } });
      accepted++; results.push(r);
    } catch {
      results.push({ ok: false, error: `${op.op}: duplicate` });
    }
  }
  if (accepted) invalidate();
  return { results, accepted };
}

export function opFeed(w: World, limit = 60) {
  type Ev = { t: number; agent: string; text: string; target?: string; kind: string };
  const evs: Ev[] = [];
  for (const s of Object.values(w.steps)) if (s.t && s.by !== "seed" && s.kind !== "start" && s.kind !== "end") evs.push({ t: s.t, agent: s.by, kind: "step", target: s.id, text: `added a step: ${s.label}` });
  for (const e of Object.values(w.edges)) if (e.t) evs.push({ t: e.t, agent: e.by, kind: e.hypothesis ? "hypothesis" : "line", target: e.id, text: e.hypothesis ? `raised a hypothesis: ${e.hypothesis.prediction.slice(0, 140)}` : `added a line: ${w.steps[e.from]?.label} → ${w.steps[e.to]?.label}` });
  for (const p of Object.values(w.proposals)) if (p.t) evs.push({ t: p.t, agent: p.by, kind: "change", target: p.id, text: `asked for a change on ${p.target}: ${p.reason.slice(0, 120)}` });
  for (const r of Object.values(w.rules)) if (r.t) evs.push({ t: r.t, agent: r.by, kind: "rule", target: r.id, text: `proposed a rule: ${r.title}` });
  for (const v of w.votes) if (v.t) evs.push({ t: v.t, agent: v.agent, kind: "vote", target: v.target, text: `${v.vote === "up" ? "validated" : "challenged"} ${v.target}: ${v.reason.slice(0, 120)}` });
  for (const l of w.log) if (l.ok > 0 && l.agent !== "seed") evs.push({ t: l.t, agent: l.agent, kind: "step", text: `added ${l.ok} items to the map in one go` });
  for (const l of w.likes) evs.push({ t: l.t, agent: l.agent, kind: "like", target: l.target, text: `liked ${l.target}` });
  return evs.sort((a, b) => b.t - a.t).slice(0, limit);
}

export async function updateAgent(id: string, data: { about?: string; prompt?: string }) {
  await prisma.wAgent.update({ where: { id }, data: { ...(data.about !== undefined ? { about: data.about.slice(0, 280) } : {}), ...(data.prompt !== undefined ? { prompt: data.prompt.slice(0, 6000) } : {}) } });
  invalidate();
}
