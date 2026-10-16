// Read-side helpers: the outline of the map, one process as JSON, and "what should I check next" for agents.
import { net } from "./engine";
import type { World } from "./types";

const live = (s: { status: string }) => s.status === "live";

export function outline(w: World, pid = "p0", depth = 2, maxLines = 400): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  const walk = (id: string, d: number, pad: string) => {
    const p = w.processes[id];
    if (!p || seen.has(id) || lines.length >= maxLines) return;
    seen.add(id);
    const steps = Object.values(w.steps).filter(s => s.process === id && live(s) && s.kind !== "start" && s.kind !== "end");
    lines.push(`${pad}[${p.id}] ${p.title} (${steps.length} steps)${p.description ? " - " + p.description.slice(0, 110) : ""}`);
    for (const s of steps) {
      if (s.sub && w.processes[s.sub]) {
        if (d < depth) walk(s.sub, d + 1, pad + "  ");
        else lines.push(`${pad}  ${s.id} > ${s.label} [${s.sub}] (subprocess)`);
      } else lines.push(`${pad}  ${s.id} ${s.kind === "fork" ? "(fork) " : ""}${s.label}`);
    }
  };
  walk(pid, 1, "");
  return lines.join("\n") + (lines.length >= maxLines ? "\n... (truncated; ask for a deeper process id)" : "");
}

export const voteCount = (w: World, id: string) => {
  const n = net(w, id);
  return { up: n.up, down: n.down };
};

export function processJson(w: World, pid: string) {
  const p = w.processes[pid];
  if (!p) return null;
  const steps = Object.values(w.steps).filter(s => s.process === pid && live(s));
  const ids = new Set(steps.map(s => s.id));
  const edges = Object.values(w.edges).filter(e => live(e) && (ids.has(e.from) || ids.has(e.to)));
  return {
    process: { id: p.id, title: p.title, description: p.description, boundary: p.boundary, parent: p.parentStep ? w.steps[p.parentStep]?.process : null },
    steps: steps.map(s => ({ id: s.id, label: s.label, kind: s.kind, participants: s.participants, resources: s.resources, sub: s.sub, by: s.by, evidence: s.evidence, votes: voteCount(w, s.id) })),
    edges: edges.map(e => ({ id: e.id, from: e.from, to: e.to, label: e.label, prob: e.prob, impact: e.impact, loop: e.loop, hypothesis: e.hypothesis, by: e.by, evidence: e.evidence, votes: voteCount(w, e.id) })),
  };
}

type Item = { id: string; type: string; by: string; priority: number; [k: string]: unknown };

/** Things this agent has not judged yet, least-checked first. */
export function todo(w: World, agent: string, n = 25) {
  const mine = new Set(w.votes.filter(v => v.agent === agent).map(v => v.target));
  const cnt: Record<string, number> = {};
  for (const v of w.votes) cnt[v.target] = (cnt[v.target] || 0) + 1;
  const items: Item[] = [];
  for (const h of Object.values(w.edges)) {
    if (h.hypothesis && live(h) && h.by !== agent && !mine.has(h.id)) items.push({ id: h.id, type: "hypothesis", by: h.by, priority: 3 - Math.min(2, cnt[h.id] || 0), from: w.steps[h.from]?.label, to: w.steps[h.to]?.label, hypothesis: h.hypothesis, evidence: h.evidence, votes: voteCount(w, h.id) });
  }
  for (const c of Object.values(w.proposals)) {
    if (c.status === "open" && c.by !== agent && !mine.has(c.id)) items.push({ id: c.id, type: "change", by: c.by, targetLabel: w.steps[c.target]?.label ?? (w.edges[c.target] ? `${w.steps[w.edges[c.target].from]?.label} -> ${w.steps[w.edges[c.target].to]?.label}` : w.processes[c.target]?.title ?? w.rules[c.target]?.title), current: w.steps[c.target] ? { label: w.steps[c.target].label, participants: w.steps[c.target].participants, resources: w.steps[c.target].resources } : undefined, priority: 3 - Math.min(2, cnt[c.id] || 0), target: c.target, set: c.set, delete: c.delete, reason: c.reason, evidence: c.evidence, votes: voteCount(w, c.id) });
  }
  for (const r of Object.values(w.rules)) {
    if (r.status === "proposed" && r.by !== agent && !mine.has(r.id)) items.push({ id: r.id, type: "rule", by: r.by, priority: 3, title: r.title, text: r.text, evidence: r.evidence, votes: voteCount(w, r.id) });
  }
  const rest: Item[] = [];
  for (const s of Object.values(w.steps)) {
    if (live(s) && s.by !== agent && s.by !== "seed" && s.kind !== "start" && s.kind !== "end" && !mine.has(s.id)) rest.push({ id: s.id, type: "step", by: s.by, priority: 1 - Math.min(1, cnt[s.id] || 0), process: w.processes[s.process]?.title, label: s.label, participants: s.participants, evidence: s.evidence });
  }
  for (const e of Object.values(w.edges)) {
    if (live(e) && !e.hypothesis && e.by !== agent && !mine.has(e.id)) rest.push({ id: e.id, type: "line", by: e.by, priority: 1 - Math.min(1, cnt[e.id] || 0), from: w.steps[e.from]?.label, to: w.steps[e.to]?.label, impact: e.impact, evidence: e.evidence });
  }
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  rest.sort((a, b) => b.priority - a.priority);
  // open change requests and proposed rules come first: they need validators most, and many hypotheses would otherwise fill the whole list
  const rank: Record<string, number> = { rule: 0, change: 1, hypothesis: 2 };
  items.sort((x, y) => (rank[x.type] ?? 3) - (rank[y.type] ?? 3) || y.priority - x.priority);
  return { unjudged: items.length + rest.length, items: [...items, ...rest].slice(0, n) };
}
