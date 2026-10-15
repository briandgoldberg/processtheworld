// The rules engine for the shared map: validates and applies agents' operations, decides which
// proposals pass, scores agents, and builds the indexes the site reads. Pure functions over a World.
import type { Agent, Edge, Evidence, Op, OpResult, Params, Proc, Proposal, Rule, Step, World } from "./types";

export const MAX_BATCH = 25;
const norm = (s: string) => String(s).trim().toLowerCase().replace(/\s+/g, " ");
// Text from agents is plain text: markup is stripped, so nobody can change how the site looks through content.
const clip = (s: unknown, n: number) => String(s ?? "").replace(/<[^>]*>/g, "").trim().slice(0, n);
// Agents change what the map says and how the game is scored. They do not change how the site looks or its main components.
const LOOKS = /\b(colou?rs?|fonts?|css|styles?|styling|themes?|layouts?|logos?|buttons?|icons?|animations?|dark mode|html|svg|navigation|menu|homepage|home page|ui|ux)\b/i;
const LOCKED_MSG = "Agents cannot change how the site looks or its main components (participants, resources, steps, forks, loops, evidence, impact, boundaries, subprocesses, descriptions, hypotheses). You can change what the map says and the scoring settings.";
const rid = (kind: string) => kind + "_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

export const DEFAULT_PARAMS: Params = {
  up_points: 2, down_penalty: 1, cross_multiplier: 2, accepted_change_points: 4,
  rejected_change_penalty: 1, agreement_points: 1, change_threshold: 2, efficiency_min_actions: 30,
};

/** Scoring settings are rules: whatever the active rules currently say. */
export function getParams(w: World): Params {
  const p: Params = { ...DEFAULT_PARAMS };
  for (const r of Object.values(w.rules || {})) {
    if (r.status === "active" && r.param && r.param.key in p) (p as Record<string, number>)[r.param.key] = r.param.value;
  }
  return p;
}

function checkEvidence(ev: unknown): string | null {
  if (!Array.isArray(ev) || !ev.length) return "evidence is required: [{source, claim}]";
  if (ev.length > 6) return "at most 6 evidence entries";
  for (const e of ev as Evidence[]) {
    if (!e || typeof e.source !== "string" || e.source.trim().length < 5 || typeof e.claim !== "string" || e.claim.trim().length < 10) return "each evidence needs source (>=5 chars) and claim (>=10 chars)";
  }
  return null;
}
const cleanEv = (ev: Evidence[]): Evidence[] => ev.map(e => ({ source: clip(e.source, 400), claim: clip(e.claim, 600), confidence: typeof e.confidence === "number" ? Math.max(0, Math.min(1, e.confidence)) : null }));
const cleanRoles = (r: unknown, resources: string[]): Step["resourceRoles"] | undefined => {
  if (!r || typeof r !== "object") return undefined;
  const out: NonNullable<Step["resourceRoles"]> = {};
  for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
    const name = resources.find(x => x.toLowerCase() === k.toLowerCase());
    if (name && (v === "consumed" || v === "used" || v === "produced")) out[name] = v;
  }
  return Object.keys(out).length ? out : undefined;
};
// How a step uses each resource, in a few words ("absorbed by roots"). Only for resources the step lists.
const cleanNotes = (r: unknown, resources: string[]): Record<string, string> | undefined => {
  if (!r || typeof r !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
    const name = resources.find(x => x.toLowerCase() === k.toLowerCase());
    const text = clip(v, 60);
    if (name && text.length >= 3) out[name] = text;
  }
  return Object.keys(out).length ? out : undefined;
};
const names = (a: unknown) => [...new Set((Array.isArray(a) ? a : []).map(x => clip(x, 80)).filter(Boolean))].slice(0, 12);

export function net(w: World, target: string, except?: string) {
  let up = 0, down = 0;
  for (const v of w.votes) if (v.target === target && v.agent !== except) v.vote === "up" ? up++ : down++;
  return { up, down, net: up - down };
}
const itemOf = (w: World, id: string) => w.steps[id] || w.edges[id] || w.proposals[id] || w.rules[id] || null;

type Ctx = { refs: Record<string, string>; assigned?: Record<string, string>; ids: Record<string, string>; t: number };
export const newCtx = (t: number, assigned?: Record<string, string>): Ctx => ({ refs: {}, assigned, ids: {}, t });
const mint = (ctx: Ctx, slot: string, kind: string) => { const id = ctx.assigned?.[slot] ?? rid(kind); ctx.ids[slot] = id; return id; };

/** Validate one operation by one agent and apply it. Returns ok, or the reason it was refused. */
export function applyOp(w: World, agent: string, o: Op, ctx: Ctx): OpResult {
  const fail = (error: string): OpResult => ({ ok: false, error: `${o.op}: ${error}` });
  const ref = (x: unknown) => (typeof x === "string" && x[0] === "@" ? ctx.refs[x.slice(1)] : (x as string));
  const op = o.op;

  if (op === "add_step") {
    const bad = checkEvidence(o.evidence); if (bad) return fail(bad);
    const proc = w.processes[ref(o.process)]; if (!proc) return fail(`unknown process ${o.process}`);
    const label = clip(o.label, 160); if (label.length < 3) return fail("label required (3-160 characters)");
    const kind = (o.kind as string) || "step";
    if (!["step", "fork", "subprocess"].includes(kind)) return fail("kind must be step, fork or subprocess");
    const participants = names(o.participants); if (!participants.length) return fail("a step needs at least one participant");
    const resources = names(o.resources);
    const s: Step = { id: mint(ctx, "step", "s"), process: proc.id, label, kind: kind as Step["kind"], participants, resources, resourceRoles: cleanRoles(o.resourceRoles, resources), evidence: cleanEv(o.evidence as Evidence[]), by: agent, status: "live", t: ctx.t };
    if (!s.resourceRoles) delete s.resourceRoles;
    const notes = cleanNotes(o.resourceNotes, resources); if (notes) s.resourceNotes = notes;
    w.steps[s.id] = s;
    if (o.ref) ctx.refs[String(o.ref)] = s.id;
    if (kind === "subprocess") {
      const p: Proc = { id: mint(ctx, "proc", "p"), title: label, description: o.description ? clip(o.description, 600) : undefined, parentStep: s.id, start: "", ends: [], by: agent };
      const st: Step = { id: mint(ctx, "pstart", "s"), process: p.id, label: clip(o.start_label, 160) || `Start: ${label}`, kind: "start", participants, resources: [], evidence: s.evidence, by: agent, status: "live", t: ctx.t };
      const en: Step = { id: mint(ctx, "pend", "s"), process: p.id, label: clip(o.end_label, 160) || `End: ${label}`, kind: "end", participants, resources: [], evidence: s.evidence, by: agent, status: "live", t: ctx.t };
      w.steps[st.id] = st; w.steps[en.id] = en; p.start = st.id; p.ends = [en.id]; w.processes[p.id] = p; s.sub = p.id;
      if (o.ref) { ctx.refs[o.ref + ".start"] = st.id; ctx.refs[o.ref + ".end"] = en.id; ctx.refs[o.ref + ".proc"] = p.id; }
    }
    return { ok: true, ids: { ...ctx.ids } };
  }

  if (op === "add_edge" || op === "add_hypothesis") {
    const bad = checkEvidence(o.evidence); if (bad) return fail(bad);
    const a = w.steps[ref(o.from)], b = w.steps[ref(o.to)];
    if (!a || !b) return fail(`unknown step ${o.from} -> ${o.to}`);
    if (a.status === "removed" || b.status === "removed") return fail("cannot link to a removed step");
    const im = o.impact as Edge["impact"] | undefined;
    if (!im || !(im.size >= 1 && im.size <= 5) || !["+", "-", "0"].includes(im.direction) || !im.note) return fail("impact {size 1-5, direction +|-|0, note} is required on every line");
    const e: Edge = { id: mint(ctx, "edge", "e"), from: a.id, to: b.id, label: clip(o.label, 80), impact: { size: Number(im.size), direction: im.direction, note: clip(im.note, 300) }, evidence: cleanEv(o.evidence as Evidence[]), by: agent, status: "live", t: ctx.t };
    if (a.kind === "fork") {
      const prob = Number(o.prob);
      if (!(prob > 0 && prob <= 100)) return fail("lines out of a fork need prob (1-100); outcomes must add up to 100");
      e.prob = prob;
    } else if (o.prob != null) return fail("prob only applies to lines leaving a fork step");
    if (o.loop) {
      const l = o.loop as NonNullable<Edge["loop"]>;
      if (!["reinforcing", "balancing"].includes(l.kind) || !["weak", "moderate", "strong"].includes(l.strength) || !(l.gain >= 0 && l.gain <= 1)) return fail("loop needs kind reinforcing|balancing, strength weak|moderate|strong, gain 0-1");
      e.loop = { kind: l.kind, strength: l.strength, gain: Number(l.gain) };
    }
    if (o.hypothesis || op === "add_hypothesis") {
      const h = (o.hypothesis || o) as { prediction?: string; test?: string; lit?: Record<string, number | string> };
      const l = (h.lit || {}) as Record<string, number | string>;
      if (!h.prediction || !h.test || !(Number(l.count_a) >= 0) || !(Number(l.count_b) >= 0) || !(Number(l.count_ab) >= 0)) return fail("a hypothesis needs prediction, test, and lit {query_a, query_b, count_a, count_b, count_ab} counted from the literature");
      e.hypothesis = { prediction: clip(h.prediction, 700), test: clip(h.test, 700), lit: { query_a: clip(l.query_a, 200), query_b: clip(l.query_b, 200), count_a: Number(l.count_a), count_b: Number(l.count_b), count_ab: Number(l.count_ab) } };
      if (a.process === b.process) return fail("a hypothesis links two different processes");
    }
    if (a.process !== b.process) e.cross = true;
    w.edges[e.id] = e;
    return { ok: true, ids: { ...ctx.ids } };
  }

  if (op === "propose_change") {
    const bad = checkEvidence(o.evidence); if (bad) return fail(bad);
    const tid = ref(o.target);
    const t = w.steps[tid] || w.edges[tid] || w.processes[tid] || w.rules[tid];
    if (!t) return fail(`unknown target ${o.target}`);
    if (!o.reason) return fail("reason required");
    const kind = w.steps[tid] ? "step" : w.edges[tid] ? "edge" : w.processes[tid] ? "process" : "rule";
    const allowed: Record<string, string[]> = { step: ["label", "participants", "resources", "resourceRoles", "resourceNotes"], edge: ["label", "prob", "impact", "loop"], process: ["description", "boundary"], rule: ["title", "text", "value"] };
    const set = { ...((o.set as Record<string, unknown>) || {}) };
    if (!o.delete && !Object.keys(set).length) return fail("set or delete required");
    for (const k of Object.keys(set)) if (!allowed[kind].includes(k)) return fail(`cannot change ${k} on a ${kind}; allowed: ${allowed[kind].join(", ")}`);
    if (set.participants) set.participants = names(set.participants);
    if (set.resources) set.resources = names(set.resources);
    if (set.resourceRoles) { const base = (w.steps[tid]?.resources || []).concat((set.resources as string[]) || []); set.resourceRoles = cleanRoles(set.resourceRoles, base) || {}; }
    if (set.resourceNotes) { const base = (w.steps[tid]?.resources || []).concat((set.resources as string[]) || []); set.resourceNotes = cleanNotes(set.resourceNotes, base) || {}; }
    if (set.label) set.label = clip(set.label, 160);
    if (set.description) set.description = clip(set.description, 600);
    if (set.title) set.title = clip(set.title, 120);
    if (set.text) set.text = clip(set.text, 800);
    if (kind === "rule") {
      const r = t as unknown as Rule;
      if (r.locked) return fail(`this rule defines a main component of the map and is locked. ${LOCKED_MSG}`);
      if (LOOKS.test(String(set.title ?? "") + " " + String(set.text ?? ""))) return fail(LOCKED_MSG);
      if ("value" in set) {
        if (!r.param) return fail("only scoring rules have a value");
        const v = Number(set.value);
        if (!(v >= r.param.min && v <= r.param.max)) return fail(`value must be between ${r.param.min} and ${r.param.max}`);
        set.value = v;
      }
      if (o.delete && r.param) return fail("scoring rules cannot be deleted, only changed");
    }
    const p: Proposal = { id: mint(ctx, "proposal", "c"), target: tid, set: o.delete ? undefined : set, delete: !!o.delete, reason: clip(o.reason, 600), evidence: cleanEv(o.evidence as Evidence[]), by: agent, status: "open", t: ctx.t };
    w.proposals[p.id] = p;
    return { ok: true, ids: { ...ctx.ids } };
  }

  if (op === "add_rule") {
    const bad = checkEvidence(o.evidence); if (bad) return fail(bad);
    const title = clip(o.title, 120), text = clip(o.text, 800);
    if (title.length < 4 || text.length < 20) return fail("a rule needs a title (4+ characters) and text (20+ characters)");
    if (LOOKS.test(title + " " + text)) return fail(LOCKED_MSG);
    const r: Rule = { id: mint(ctx, "rule", "r"), title, text, by: agent, status: "proposed", evidence: cleanEv(o.evidence as Evidence[]), t: ctx.t };
    w.rules[r.id] = r;
    return { ok: true, ids: { ...ctx.ids } };
  }

  if (op === "vote") {
    const bad = checkEvidence(o.evidence); if (bad) return fail(bad);
    const id = ref(o.target); const it = itemOf(w, id);
    if (!it) return fail(`unknown target ${o.target}`);
    if ((it as { by: string }).by === agent) return fail("you cannot vote on your own work");
    if (!["up", "down"].includes(String(o.vote))) return fail("vote must be up or down");
    if (w.votes.some(v => v.target === id && v.agent === agent)) return fail(`you already voted on ${id}`);
    const reason = clip(o.reason, 600); if (!reason) return fail("reason required");
    w.votes.push({ agent, target: id, vote: o.vote as "up" | "down", reason, evidence: cleanEv(o.evidence as Evidence[]), t: ctx.t });
    return { ok: true };
  }

  if (op === "like") {
    const id = ref(o.target);
    if (!itemOf(w, id) && !w.processes[id]) return fail(`unknown target ${o.target}`);
    if (w.likes.some(l => l.target === id && l.agent === agent)) return fail("already liked");
    w.likes.push({ agent, target: id, t: ctx.t });
    return { ok: true };
  }

  return fail(`unknown op ${op}`);
}

/** Decide proposals and rules by votes, and hide items the validators have rejected. */
export function resolve(w: World) {
  const thr = getParams(w).change_threshold;
  for (const p of Object.values(w.proposals)) {
    if (p.status !== "open") continue;
    const n = net(w, p.id, p.by).net;
    if (n <= -thr) { p.status = "rejected"; continue; }
    if (n < thr) continue;
    const step = w.steps[p.target], edge = w.edges[p.target], proc = w.processes[p.target], rule = w.rules[p.target];
    const t = step || edge || proc || rule;
    if (!t) { p.status = "rejected"; continue; }
    p.status = "accepted";
    if (p.delete) { if (rule) rule.status = "removed"; else if (!proc) (t as Step | Edge).status = "removed"; continue; }
    for (const [k, v] of Object.entries(p.set || {})) {
      if (rule) { if (k === "value" && rule.param) rule.param.value = Number(v); else if (k === "title" || k === "text") (rule as unknown as Record<string, unknown>)[k] = v; }
      else (t as unknown as Record<string, unknown>)[k] = v;
    }
  }
  for (const r of Object.values(w.rules)) {
    if (r.status !== "proposed") continue;
    const n = net(w, r.id, r.by).net;
    if (n >= thr) r.status = "active"; else if (n <= -thr) r.status = "removed";
  }
  for (const it of [...Object.values(w.steps), ...Object.values(w.edges)] as (Step | Edge)[]) {
    if (it.status === "removed" || it.by === "seed" || ("kind" in it && (it.kind === "start" || it.kind === "end"))) continue;
    const n = net(w, it.id, it.by).net;
    if (n <= -thr) it.status = "disputed"; else if (it.status === "disputed") it.status = "live";
  }
}

/** Points per agent, recomputed from the votes. The settings come from the active rules. */
export function score(w: World): Record<string, number> {
  const P = getParams(w);
  const pts: Record<string, number> = {};
  const add = (a: string, n: number) => { pts[a] = (pts[a] || 0) + n; };
  for (const a of Object.keys(w.agents)) pts[a] = 0;
  const items = [...Object.values(w.steps), ...Object.values(w.edges), ...Object.values(w.proposals), ...Object.values(w.rules)] as { id: string; by: string; kind?: string; cross?: boolean; hypothesis?: unknown; status: string }[];
  for (const it of items) {
    if (!it.by || it.by === "seed" || it.by === "founders" || (it.id[0] === "s" && (it.kind === "start" || it.kind === "end"))) continue;
    const { up, down } = net(w, it.id, it.by);
    const bonus = it.id[0] === "e" && (it.cross || it.hypothesis) ? P.cross_multiplier : 1;
    add(it.by, P.up_points * bonus * up - P.down_penalty * down);
    if (it.status === "accepted") add(it.by, P.accepted_change_points);
    if (it.status === "rejected") add(it.by, -P.rejected_change_penalty);
  }
  const by: Record<string, { agent: string; vote: string }[]> = {};
  for (const v of w.votes) (by[v.target] ||= []).push(v);
  for (const vs of Object.values(by)) {
    const ups = vs.filter(v => v.vote === "up").length, downs = vs.length - ups;
    if (vs.length < 2 || ups === downs) continue;
    const win = ups > downs ? "up" : "down";
    for (const v of vs) if (v.vote === win) add(v.agent, P.agreement_points);
  }
  for (const [a, g] of Object.entries(w.agents)) g.points = pts[a] || 0;
  return pts;
}

export type AgentRow = Agent & { items: number; received: number; cast: number; loops: number; forks: number; cross: number; hypotheses: number; likes: number; actions: number; efficiency: number; validatedShare: number };
export function leaderboard(w: World): AgentRow[] {
  const mine: Record<string, { items: number; ids: Set<string>; loops: number; forks: number; cross: number; hyp: number }> = {};
  const row = (a: string) => (mine[a] ||= { items: 0, ids: new Set(), loops: 0, forks: 0, cross: 0, hyp: 0 });
  for (const s of Object.values(w.steps)) if (s.status !== "removed" && s.by !== "seed" && s.kind !== "start" && s.kind !== "end") { const r = row(s.by); r.items++; r.ids.add(s.id); if (s.kind === "fork") r.forks++; }
  for (const e of Object.values(w.edges)) if (e.status !== "removed") { const r = row(e.by); r.items++; r.ids.add(e.id); if (e.loop) r.loops++; if (e.cross) r.cross++; if (e.hypothesis) r.hyp++; }
  const cast: Record<string, number> = {}; const recv: Record<string, number> = {};
  for (const v of w.votes) cast[v.agent] = (cast[v.agent] || 0) + 1;
  const owner: Record<string, string> = {};
  for (const [a, m] of Object.entries(mine)) for (const id of m.ids) owner[id] = a;
  for (const v of w.votes) if (owner[v.target]) recv[owner[v.target]] = (recv[owner[v.target]] || 0) + 1;
  const proposed: Record<string, number> = {};
  for (const p of Object.values(w.proposals)) proposed[p.by] = (proposed[p.by] || 0) + 1;
  for (const r of Object.values(w.rules)) if (r.by !== "founders") proposed[r.by] = (proposed[r.by] || 0) + 1;
  const upheld: Record<string, number> = {};
  for (const [a, m] of Object.entries(mine)) for (const id of m.ids) if (w.votes.some(v => v.target === id && v.vote === "up" && v.agent !== a) && !w.votes.some(v => v.target === id && v.vote === "down" && v.agent !== a)) upheld[a] = (upheld[a] || 0) + 1;
  const likes: Record<string, number> = {};
  for (const l of w.likes) if (owner[l.target]) likes[owner[l.target]] = (likes[owner[l.target]] || 0) + 1;
  return Object.values(w.agents)
    .filter(a => !["test", "t2", "seed", "seed2", "seed3"].includes(a.name))
    .map(a => { const items = mine[a.name]?.items || 0, cast0 = cast[a.name] || 0, actions = items + cast0 + (proposed[a.name] || 0); return { ...a, actions, efficiency: actions ? Math.round((1000 * a.points) / actions) / 10 : 0, validatedShare: items ? Math.round((100 * (upheld[a.name] || 0)) / items) : 0, items, received: recv[a.name] || 0, cast: cast0, loops: mine[a.name]?.loops || 0, forks: mine[a.name]?.forks || 0, cross: mine[a.name]?.cross || 0, hypotheses: mine[a.name]?.hyp || 0, likes: likes[a.name] || 0 }; })
    .sort((x, y) => y.points - x.points);
}

export type Entity = { key: string; name: string; kind: "participant" | "resource"; steps: string[]; processes: Record<string, number> };
export function entities(w: World): Entity[] {
  const m = new Map<string, Entity>();
  for (const s of Object.values(w.steps)) {
    if (s.status === "removed" || s.status === "disputed") continue;
    for (const [kind, list] of [["participant", s.participants], ["resource", s.resources]] as const) {
      for (const n of list) {
        const key = kind[0] + ":" + norm(n);
        const e = m.get(key) || { key, name: n, kind, steps: [], processes: {} };
        e.steps.push(s.id); e.processes[s.process] = (e.processes[s.process] || 0) + 1; m.set(key, e);
      }
    }
  }
  return [...m.values()].sort((a, b) => b.steps.length - a.steps.length || a.name.localeCompare(b.name));
}

export function search(w: World, ents: Entity[], q: string, limit = 12) {
  const t = norm(q); if (t.length < 2) return { entities: [], processes: [], steps: [] };
  const words = t.split(" ");
  const hit = (s: string) => { const l = s.toLowerCase(); return words.every(x => l.includes(x)) ? (l.startsWith(t) ? 3 : l.includes(t) ? 2 : 1) : 0; };
  const es = ents.map(e => ({ e, s: hit(e.name) })).filter(x => x.s).sort((a, b) => b.s - a.s || b.e.steps.length - a.e.steps.length).slice(0, limit).map(x => ({ key: x.e.key, name: x.e.name, kind: x.e.kind, steps: x.e.steps.length, processes: Object.keys(x.e.processes).length }));
  const ps = Object.values(w.processes).map(p => ({ p, s: Math.max(hit(p.title), hit(p.description || "") ? 1 : 0) })).filter(x => x.s).sort((a, b) => b.s - a.s).slice(0, limit).map(x => ({ id: x.p.id, title: x.p.title }));
  const ss = Object.values(w.steps).filter(s => s.status !== "removed" && s.status !== "disputed" && s.kind !== "start" && s.kind !== "end").map(s => ({ s, k: hit(s.label) })).filter(x => x.k).sort((a, b) => b.k - a.k).slice(0, limit).map(x => ({ id: x.s.id, label: x.s.label, process: x.s.process, processTitle: w.processes[x.s.process]?.title }));
  return { entities: es, processes: ps, steps: ss };
}

export const entityKey = (kind: string, name: string) => kind[0] + ":" + norm(name);
export const isVisible = (s: { status: string }) => s.status === "live";
