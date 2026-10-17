// Reads the map as a graph: how sure we are of each line, how much of the map sits downstream of it, where a
// link is probably missing, which lines contradict each other, and every path between two steps with its
// weakest link. Pure functions over a World; results are memoised per World object.
import type { Edge, Step, World } from "./types";
import { net } from "./engine";
import { roleOf } from "./roles";

const live = (x: { status: string } | undefined) => !!x && x.status === "live";
const real = (s: Step | undefined) => !!s && s.status === "live" && s.kind !== "start" && s.kind !== "end";
const LINK = /https?:\/\/[^\s)>\]"',;]+|\b10\.\d{4,9}\/[^\s)>\]"',;]+/gi;
const STOP = new Set("the and of in on for a an to from with by at into out over under about per than that this these those are is be as or its it their more less most about through between when where which while also only some each both".split(" "));
const tokens = (s: string) => new Set((s.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || []).filter(x => !STOP.has(x)));
const jaccard = (a: Set<string>, b: Set<string>) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n || 1); };

/** 0-1: how much to trust a line, from its evidence, links, votes and status. */
export function edgeConfidence(w: World, e: Edge): { conf: number; reasons: string[] } {
  const reasons: string[] = [];
  const confs = e.evidence.map(x => x.confidence).filter((c): c is number => typeof c === "number");
  let c = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0.5;
  reasons.push(confs.length ? `cited confidence ${c.toFixed(2)}` : "no confidence given");
  const links = new Set(e.evidence.flatMap(x => (String(x.source).match(LINK) || []).map(l => l.toLowerCase()))).size;
  if (links >= 2) { c += 0.15; reasons.push(`${links} links`); } else if (links === 1) { c += 0.1; reasons.push("1 link"); } else reasons.push("no link to a source");
  const v = net(w, e.id, e.by);
  if (v.up) { c += 0.08 * Math.min(v.up, 3); reasons.push(`${v.up} up`); }
  if (v.down) { c -= 0.15 * v.down; reasons.push(`${v.down} down`); }
  if (e.impact.elasticity != null || e.impact.value != null) { c += 0.05; reasons.push("quantified"); } else reasons.push("not quantified");
  if (e.status === "disputed") { c *= 0.5; reasons.push("disputed"); }
  return { conf: Math.max(0.05, Math.min(0.98, c)), reasons };
}

type Hop = { to: string; edge?: string; kind: "line" | "loop" | "enter" | "exit" };
/** Forward adjacency over live lines, stepping into a subprocess at its start ("enter") and out again from its ends ("exit"). */
export function forwardIndex(w: World): Map<string, Hop[]> {
  const idx = new Map<string, Hop[]>();
  const push = (from: string, h: Hop) => { (idx.get(from) || idx.set(from, []).get(from)!).push(h); };
  for (const e of Object.values(w.edges)) if (live(e) && live(w.steps[e.from]) && live(w.steps[e.to])) push(e.from, { to: e.to, edge: e.id, kind: e.loop ? "loop" : "line" });
  for (const s of Object.values(w.steps)) {
    if (!live(s) || !s.sub) continue;
    const p = w.processes[s.sub]; if (!p) continue;
    if (w.steps[p.start]) push(s.id, { to: p.start, kind: "enter" });
    for (const end of p.ends || []) if (w.steps[end]) push(end, { to: s.id, kind: "exit" });
  }
  return idx;
}

type Memo = { idx: Map<string, Hop[]>; down: Map<string, number> };
const memo = new WeakMap<World, Memo>();
const mem = (w: World): Memo => { let m = memo.get(w); if (!m) { m = { idx: forwardIndex(w), down: new Map() }; memo.set(w, m); } return m; };

const DOWN_DEPTH = 8;
/** How many distinct real steps follow this one within 8 hops, going forward along lines and down into subprocesses:
 *  what depends on it. Loops and climbing back out of a subprocess are not followed, otherwise every step would
 *  reach the whole map and the number would say nothing. */
export function downstream(w: World, stepId: string): number {
  const m = mem(w);
  const hit = m.down.get(stepId); if (hit != null) return hit;
  const seen = new Set<string>([stepId]); let frontier = [stepId]; let n = 0;
  for (let d = 0; d < DOWN_DEPTH && frontier.length; d++) {
    const next: string[] = [];
    for (const cur of frontier) for (const h of m.idx.get(cur) || []) {
      if (h.kind === "loop" || h.kind === "exit" || seen.has(h.to)) continue;
      seen.add(h.to); next.push(h.to); if (real(w.steps[h.to])) n++;
    }
    frontier = next;
  }
  m.down.set(stepId, n);
  return n;
}

const stepOut = (w: World, id: string) => { const s = w.steps[id]; return { id, label: s?.label || id, process: s?.process || "", processTitle: (s && w.processes[s.process]?.title) || "" }; };

export type WeakEdge = { id: string; from: ReturnType<typeof stepOut>; to: ReturnType<typeof stepOut>; by: string; impact: Edge["impact"]; conf: number; reasons: string[]; downstream: number; weight: number; sources: string[] };
/** Lines that carry a lot of the map on little evidence: the best places to add or challenge evidence. */
export function weakEdges(w: World, n = 40, only?: (e: Edge) => boolean): WeakEdge[] {
  const out: WeakEdge[] = [];
  for (const e of Object.values(w.edges)) {
    if (e.status === "removed" || e.hypothesis || !real(w.steps[e.from]) || !real(w.steps[e.to]) || (only && !only(e))) continue;
    const { conf, reasons } = edgeConfidence(w, e);
    const d = downstream(w, e.to) + 1;
    out.push({ id: e.id, from: stepOut(w, e.from), to: stepOut(w, e.to), by: e.by, impact: e.impact, conf, reasons, downstream: d, weight: Math.round(d * (1 - conf) * 10) / 10, sources: e.evidence.map(x => x.source) });
  }
  return out.sort((a, b) => b.weight - a.weight).slice(0, n);
}

export type MissingLink = { resource: string; from: ReturnType<typeof stepOut>; to: ReturnType<typeof stepOut>; downstream: number; weight: number; hypothesis?: string };
/** Steps in different processes where one makes a resource another uses, with no line or hypothesis between them. */
export function missingLinks(w: World, n = 60): MissingLink[] {
  const prod = new Map<string, Step[]>(), cons = new Map<string, Step[]>();
  for (const s of Object.values(w.steps)) {
    if (!real(s)) continue;
    for (const r of s.resources) {
      const k = r.toLowerCase();
      const role = roleOf(s, r).role;
      if (role === "produced") (prod.get(k) || prod.set(k, []).get(k)!).push(s); else (cons.get(k) || cons.set(k, []).get(k)!).push(s);
    }
  }
  const linked = new Set<string>(); const hyp = new Map<string, string>();
  for (const e of Object.values(w.edges)) if (e.status !== "removed") { linked.add(e.from + ">" + e.to); linked.add(e.to + ">" + e.from); if (e.hypothesis) hyp.set(e.from + ">" + e.to, e.id); }
  const all: (MissingLink & { pairs: number })[] = [];
  for (const [r, ps] of prod) {
    const cs = cons.get(r); if (!cs) continue;
    const list: (MissingLink & { pairs: number })[] = []; const seen = new Set<string>();
    for (const a of ps) for (const b of cs) {
      if (a.id === b.id || a.process === b.process || linked.has(a.id + ">" + b.id) || seen.has(a.id + ">" + b.id)) continue;
      seen.add(a.id + ">" + b.id);
      const d = downstream(w, b.id) + 1;
      list.push({ resource: r, from: stepOut(w, a.id), to: stepOut(w, b.id), downstream: d, weight: d, hypothesis: hyp.get(a.id + ">" + b.id), pairs: 0 });
    }
    // a resource that everything makes and uses (water, carbon dioxide) is a weak cue: a specific one (geosmin, molybdate) a strong one
    for (const x of list) x.pairs = list.length;
    all.push(...list.sort((x, y) => y.weight - x.weight).slice(0, 3));
  }
  const perTarget = new Map<string, number>();
  return all
    .sort((a, b) => b.weight - a.weight || a.pairs - b.pairs)
    .filter(m => { const k = (perTarget.get(m.to.id) || 0) + 1; perTarget.set(m.to.id, k); return k <= 2; })
    .slice(0, n)
    .map(({ pairs: _p, ...m }) => m);
}

export type Contradiction = { a: WeakEdge; b: WeakEdge; kind: "sign" | "size" | "range"; note: string };
/** Pairs of lines about the same mechanism (same or near-same steps) that disagree in sign, size or range. */
export function contradictions(w: World, n = 50): Contradiction[] {
  // lines leaving a fork describe shares of an outcome, not an effect size, so they are not compared
  const edges = Object.values(w.edges).filter(e => e.status !== "removed" && !e.hypothesis && e.prob == null && real(w.steps[e.from]) && real(w.steps[e.to]));
  const tf = new Map<string, Set<string>>(), tt = new Map<string, Set<string>>();
  const index = new Map<string, string[]>();
  for (const e of edges) {
    const f = tokens(w.steps[e.from].label), t = tokens(w.steps[e.to].label);
    tf.set(e.id, f); tt.set(e.id, t);
    for (const x of f) (index.get(x) || index.set(x, []).get(x)!).push(e.id);
  }
  const byId = new Map(edges.map(e => [e.id, e]));
  const out: Contradiction[] = []; const done = new Set<string>();
  const row = (e: Edge): WeakEdge => { const { conf, reasons } = edgeConfidence(w, e); return { id: e.id, from: stepOut(w, e.from), to: stepOut(w, e.to), by: e.by, impact: e.impact, conf, reasons, downstream: downstream(w, e.to) + 1, weight: 0, sources: e.evidence.map(x => x.source) }; };
  for (const a of edges) {
    const shared = new Map<string, number>();
    for (const x of tf.get(a.id)!) for (const id of index.get(x) || []) if (id !== a.id) shared.set(id, (shared.get(id) || 0) + 1);
    for (const [id, k] of shared) {
      const b = byId.get(id)!; const key = a.id < b.id ? a.id + "|" + b.id : b.id + "|" + a.id;
      if (done.has(key)) continue;
      const same = a.from === b.from && a.to === b.to;
      if (!same && (k < 2 || jaccard(tf.get(a.id)!, tf.get(b.id)!) < 0.5 || jaccard(tt.get(a.id)!, tt.get(b.id)!) < 0.5)) continue;
      done.add(key);
      const ia = a.impact, ib = b.impact;
      let kind: Contradiction["kind"] | null = null, note = "";
      if (ia.direction !== "0" && ib.direction !== "0" && ia.direction !== ib.direction) { kind = "sign"; note = `one says the effect is ${ia.direction === "+" ? "positive" : "negative"}, the other ${ib.direction === "+" ? "positive" : "negative"}`; }
      else if (ia.elasticity != null && ib.elasticity != null) {
        const [al, ah] = [ia.low ?? ia.elasticity * 0.5, ia.high ?? ia.elasticity * 1.5].sort((x, y) => x - y), [bl, bh] = [ib.low ?? ib.elasticity * 0.5, ib.high ?? ib.elasticity * 1.5].sort((x, y) => x - y);
        if (ah < bl || bh < al) { kind = "range"; note = `elasticity ${ia.elasticity} (${al} to ${ah}) versus ${ib.elasticity} (${bl} to ${bh}) do not overlap`; }
      } else if (Math.abs(ia.size - ib.size) >= 3) { kind = "size"; note = `impact ${ia.direction}${ia.size} of 5 versus ${ib.direction}${ib.size} of 5`; }
      if (kind) out.push({ a: row(a), b: row(b), kind, note });
    }
  }
  return out.sort((x, y) => Math.max(y.a.downstream, y.b.downstream) - Math.max(x.a.downstream, x.b.downstream)).slice(0, n);
}

export type PathHop = { step: ReturnType<typeof stepOut>; edge?: { id: string; impact: Edge["impact"]; conf: number; reasons: string[]; sources: string[]; by: string; loop: boolean } };
export type Path = { hops: PathHop[]; weakest: number | null; sign: "+" | "-" | "0" | "?"; elasticity?: { value: number; low: number; high: number }; quantified: number; lines: number };
/** Every simple forward path between two steps (bounded), each with its weakest line and composed elasticity. */
export function paths(w: World, from: string, to: string, maxDepth = 10, maxPaths = 30): Path[] {
  const idx = mem(w).idx;
  const found: Hop[][] = [];
  const walk = (cur: string, trail: Hop[], seen: Set<string>) => {
    if (found.length >= maxPaths || trail.length > maxDepth) return;
    for (const h of idx.get(cur) || []) {
      if (seen.has(h.to)) continue;
      if (h.to === to) { found.push([...trail, h]); if (found.length >= maxPaths) return; continue; }
      seen.add(h.to); walk(h.to, [...trail, h], seen); seen.delete(h.to);
    }
  };
  if (from !== to && w.steps[from] && w.steps[to]) walk(from, [], new Set([from]));
  found.sort((a, b) => a.length - b.length);
  return found.map(trail => {
    const hops: PathHop[] = [{ step: stepOut(w, from) }];
    let weakest: number | null = null, weakConf = 2, sign: Path["sign"] = "+", quantified = 0, lines = 0;
    let el: { value: number; low: number; high: number } | undefined = { value: 1, low: 1, high: 1 };
    for (const h of trail) {
      const e = h.edge ? w.edges[h.edge] : undefined;
      let edge: PathHop["edge"];
      if (e) {
        lines++;
        const { conf, reasons } = edgeConfidence(w, e);
        edge = { id: e.id, impact: e.impact, conf, reasons, sources: e.evidence.map(x => x.source), by: e.by, loop: !!e.loop };
        if (conf < weakConf) { weakConf = conf; weakest = hops.length; }
        if (e.impact.direction === "0") sign = "0"; else if (sign !== "0" && e.impact.direction === "-") sign = sign === "+" ? "-" : "+";
        if (e.impact.elasticity != null && el) {
          quantified++;
          const lo = e.impact.low ?? e.impact.elasticity, hi = e.impact.high ?? e.impact.elasticity;
          const prods: number[] = [el.low * lo, el.low * hi, el.high * lo, el.high * hi];
          el = { value: el.value * e.impact.elasticity, low: Math.min(...prods), high: Math.max(...prods) };
        } else el = undefined;
      }
      hops.push({ step: stepOut(w, h.to), edge });
    }
    const round = (x: number) => Math.round(x * 1000) / 1000;
    return { hops, weakest, sign: lines ? sign : "?", elasticity: el && quantified === lines && lines > 0 ? { value: round(el.value), low: round(el.low), high: round(el.high) } : undefined, quantified, lines };
  });
}

export type Analysis = { weak: WeakEdge[]; missing: MissingLink[]; conflicts: Contradiction[]; at: number };
const analysisMemo = new WeakMap<World, Analysis>();
export function analysis(w: World): Analysis {
  let a = analysisMemo.get(w);
  if (!a) { a = { weak: weakEdges(w), missing: missingLinks(w), conflicts: contradictions(w), at: Date.now() }; analysisMemo.set(w, a); }
  return a;
}
