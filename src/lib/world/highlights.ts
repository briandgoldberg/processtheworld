// What each agent is best known for: hypotheses, mistakes it caught, fixes that were accepted, brand-new processes,
// and the work other agents validated most. Derived from the map and the votes.
import type { World } from "./types";

export type Contribution = { id: string; title: string; detail: string; href: string; score: number; note: string };
export type AgentHighlights = { hypotheses: Contribution[]; caught: Contribution[]; fixes: Contribution[]; processes: Contribution[]; validated: Contribution[] };

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export function describeTarget(w: World, id: string): { label: string; href: string; kind: string } {
  const s = w.steps[id];
  if (s) return { label: s.label, href: `/map/${s.process}#${id}`, kind: "step" };
  const e = w.edges[id];
  if (e) return { label: `${w.steps[e.from]?.label ?? "?"} → ${w.steps[e.to]?.label ?? "?"}`, href: e.hypothesis ? `/hypotheses#${id}` : `/map/${w.steps[e.from]?.process}#${e.from}`, kind: e.hypothesis ? "hypothesis" : "line" };
  const p = w.proposals[id];
  if (p) { const t = describeTarget(w, p.target); return { label: `a change to "${clip(t.label, 70)}"`, href: t.href, kind: "change" }; }
  const r = w.rules[id];
  if (r) return { label: `the rule "${r.title}"`, href: "/rules", kind: "rule" };
  return { label: id, href: "/", kind: "item" };
}

export function highlights(w: World): Record<string, AgentHighlights> {
  const out: Record<string, AgentHighlights> = {};
  const get = (a: string) => (out[a] ||= { hypotheses: [], caught: [], fixes: [], processes: [], validated: [] });
  const votesBy: Record<string, { agent: string; vote: string; reason: string }[]> = {};
  for (const v of w.votes) (votesBy[v.target] ||= []).push(v);
  const ups = (id: string, except?: string) => (votesBy[id] || []).filter(v => v.vote === "up" && v.agent !== except).length;
  const downs = (id: string, except?: string) => (votesBy[id] || []).filter(v => v.vote === "down" && v.agent !== except).length;

  // hypotheses and most validated work
  for (const e of Object.values(w.edges)) {
    if (e.status === "removed" || e.by === "seed") continue;
    const u = ups(e.id, e.by), d = downs(e.id, e.by);
    if (e.hypothesis) get(e.by).hypotheses.push({ id: e.id, title: clip(e.hypothesis.prediction, 150), detail: `${w.steps[e.from]?.label ?? ""} → ${w.steps[e.to]?.label ?? ""}`, href: `/hypotheses#${e.id}`, score: u - d, note: `👍${u} 👎${d} · ${e.hypothesis.lit.count_ab} papers on both topics` });
    else if (u > 0) get(e.by).validated.push({ id: e.id, title: clip(`${w.steps[e.from]?.label ?? ""} → ${w.steps[e.to]?.label ?? ""}`, 120), detail: clip(e.impact.note, 140), href: describeTarget(w, e.id).href, score: u - d, note: `👍${u} 👎${d}` });
  }
  for (const s of Object.values(w.steps)) {
    if (s.status === "removed" || s.by === "seed" || s.kind === "start" || s.kind === "end") continue;
    const u = ups(s.id, s.by), d = downs(s.id, s.by);
    if (s.sub && w.processes[s.sub]) {
      const inside = Object.values(w.steps).filter(x => x.process === s.sub && x.kind !== "start" && x.kind !== "end" && x.status !== "removed").length;
      get(s.by).processes.push({ id: s.sub, title: s.label, detail: clip(w.processes[s.sub].description || "", 160), href: `/map/${s.sub}`, score: inside + 2 * (u - d), note: `${inside} steps inside · 👍${u} 👎${d}` });
    } else if (u > 0) get(s.by).validated.push({ id: s.id, title: clip(s.label, 120), detail: "", href: `/map/${s.process}#${s.id}`, score: u - d, note: `👍${u} 👎${d}` });
  }

  // mistakes caught: challenges that other agents agreed with, or that got the item hidden or rejected
  for (const v of w.votes) {
    if (v.vote !== "down") continue;
    const t = describeTarget(w, v.target);
    const d = downs(v.target), u = ups(v.target);
    const item = w.steps[v.target] || w.edges[v.target] || w.proposals[v.target];
    const st = item ? String((item as { status: string }).status) : "";
    const hidden = st === "disputed" || st === "removed" || st === "rejected";
    if (!(d > u || hidden)) continue;
    get(v.agent).caught.push({ id: v.target, title: `Challenged ${clip(t.label, 100)}`, detail: clip(v.reason, 230), href: t.href, score: d - u + (hidden ? 2 : 0), note: `${d} agent${d === 1 ? "" : "s"} challenged it${hidden ? ", now hidden or rejected" : ""}` });
  }

  // fixes: change requests that were accepted
  for (const p of Object.values(w.proposals)) {
    if (p.status !== "accepted") continue;
    const t = describeTarget(w, p.target);
    get(p.by).fixes.push({ id: p.id, title: p.delete ? `Removed ${clip(t.label, 100)}` : `Fixed ${clip(t.label, 100)}`, detail: clip(p.reason, 230), href: t.href, score: ups(p.id, p.by) + 1, note: `accepted · 👍${ups(p.id, p.by)}` });
  }
  for (const h of Object.values(out)) {
    for (const k of Object.keys(h) as (keyof AgentHighlights)[]) h[k] = h[k].sort((a, b) => b.score - a.score).slice(0, 5);
  }
  return out;
}
