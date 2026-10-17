// Impact tracing: from one step, everything downstream of it, strongest first, each with the chain of cited lines
// that carries the effect. Signs multiply along the chain (two negatives make a positive), sizes multiply as
// fractions of 5, and a fork's share scales the chain by its probability. Where every line on a chain has an
// elasticity, those multiply too. Loops are not followed, so a step cannot "affect itself".
import type { Edge, World } from "./types";
import { edgeConfidence, forwardIndex } from "./analysis";

export type ImpactHop = {
  from: string; fromLabel: string; to: string; toLabel: string; kind: "line" | "enter" | "exit";
  edge?: string; dir?: Edge["impact"]["direction"]; size?: number; prob?: number; elasticity?: number; note?: string; sources?: string[]; conf?: number;
};
export type ImpactRow = {
  step: string; label: string; process: string; processTitle: string;
  sign: "+" | "-" | "0"; strength: number; hops: number; chain: ImpactHop[]; elasticity?: number; quantified: boolean;
};
export type Impact = { step: { id: string; label: string; process: string; processTitle: string }; rows: ImpactRow[]; reached: number };

const real = (w: World, id: string) => { const s = w.steps[id]; return !!s && s.status === "live" && s.kind !== "start" && s.kind !== "end"; };

/** Everything downstream of a step within `depth` hops, best chain per step, strongest first. */
export function impactOf(w: World, stepId: string, depth = 6, n = 40): Impact | null {
  const s0 = w.steps[stepId]; if (!s0) return null;
  const idx = forwardIndex(w);
  type Best = { strength: number; sign: "+" | "-" | "0"; chain: ImpactHop[]; el?: number; quantified: boolean };
  const best = new Map<string, Best>();
  let frontier: string[] = [stepId];
  best.set(stepId, { strength: 1, sign: "+", chain: [], el: 1, quantified: true });
  for (let d = 0; d < depth && frontier.length; d++) {
    const next = new Set<string>();
    for (const cur of frontier) {
      const b = best.get(cur)!;
      for (const h of idx.get(cur) || []) {
        if (h.kind === "loop" || h.to === stepId || b.chain.some(x => x.to === h.to || x.from === h.to)) continue;
        const e = h.edge ? w.edges[h.edge] : undefined;
        if (h.edge && !e) continue;
        let strength = b.strength, sign = b.sign, el = b.el, quantified = b.quantified;
        const hop: ImpactHop = { from: cur, fromLabel: w.steps[cur]?.label || cur, to: h.to, toLabel: w.steps[h.to]?.label || h.to, kind: h.kind as ImpactHop["kind"] };
        if (e) {
          strength *= (e.impact.size / 5) * (e.prob != null ? e.prob / 100 : 1);
          if (e.impact.direction === "0") { sign = "0"; strength *= 0.5; } else if (e.impact.direction === "-") sign = sign === "0" ? "0" : sign === "+" ? "-" : "+";
          if (e.impact.elasticity != null && el != null) el *= e.impact.elasticity; else { el = undefined; quantified = false; }
          hop.edge = e.id; hop.dir = e.impact.direction; hop.size = e.impact.size; hop.prob = e.prob; hop.elasticity = e.impact.elasticity; hop.note = e.impact.note; hop.sources = e.evidence.map(x => x.source); hop.conf = edgeConfidence(w, e).conf;
        }
        if (strength < 0.01) continue;
        const prev = best.get(h.to);
        if (prev && prev.strength >= strength) continue;
        best.set(h.to, { strength, sign, chain: [...b.chain, hop], el, quantified });
        next.add(h.to);
      }
    }
    frontier = [...next];
  }
  const out = (id: string) => { const s = w.steps[id]; return { id, label: s?.label || id, process: s?.process || "", processTitle: (s && w.processes[s.process]?.title) || "" }; };
  const rows: ImpactRow[] = [];
  for (const [id, b] of best) {
    if (id === stepId || !real(w, id) || !b.chain.some(h => h.edge)) continue;
    const o = out(id);
    rows.push({ step: id, label: o.label, process: o.process, processTitle: o.processTitle, sign: b.sign, strength: Math.round(b.strength * 1000) / 1000, hops: b.chain.filter(h => h.edge).length, chain: b.chain, elasticity: b.quantified && b.el != null ? Math.round(b.el * 1000) / 1000 : undefined, quantified: b.quantified });
  }
  rows.sort((a, b) => b.strength - a.strength || a.hops - b.hops);
  return { step: out(stepId), rows: rows.slice(0, n), reached: rows.length };
}

/** Plain words for a composed strength (product of sizes as fractions of 5). */
export const strengthWord = (s: number) => (s >= 0.6 ? "very large" : s >= 0.35 ? "large" : s >= 0.18 ? "moderate" : s >= 0.08 ? "small" : "very small");
