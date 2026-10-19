import type { Metadata } from "next";
import Atlas, { type AtlasData, type AtlasNode } from "@/components/atlas/Atlas";
import { listedIds } from "@/lib/world/shown";
import { getLive } from "@/lib/world/store";
import curated from "@/lib/world/curated.json";

export const metadata: Metadata = { title: "Atlas of the map", description: "Every process on the map of Earth's systems as nested circles. Zoom in from the six great cycles to the steps inside them, with the lines that cross between processes and the questions nobody has tested." };
export const revalidate = 120;

// The atlas: the whole map as nested circles. Processes contain subprocesses and steps; lines between processes are
// counted into bands; listed open questions are drawn between the steps they join.
export default async function AtlasPage() {
  const { world: w } = await getLive();
  const live = (s: { status: string } | undefined) => !!s && s.status === "live";
  const stepsOf = (pid: string) => Object.values(w.steps).filter(s => s.process === pid && live(s) && s.kind !== "start" && s.kind !== "end");
  const subOf: Record<string, string> = {}; // subprocess step id -> process id
  const build = (pid: string, depth: number): AtlasNode | null => {
    const p = w.processes[pid]; if (!p || depth > 9) return null;
    const children: AtlasNode[] = [];
    for (const s of stepsOf(pid)) {
      if (s.sub && w.processes[s.sub]) { const c = build(s.sub, depth + 1); if (c) { children.push(c); subOf[s.id] = s.sub; continue; } }
      children.push({ id: s.id, t: s.label, k: "s", e: s.evidence.length, f: s.kind === "fork" ? 1 : undefined });
    }
    return { id: pid, t: p.title, k: "p", d: (p.description || "").slice(0, 220), n: children.length ? children : [{ id: pid + "~", t: "", k: "s", e: 0 }] };
  };
  const root = build("p0", 0)!;
  // which process a step is shown in (a subprocess step is shown as its process)
  const shownAs = (sid: string) => subOf[sid] || sid;
  const procOf = (sid: string) => w.steps[sid]?.process || "";
  // cross-process lines, counted per pair of processes
  const pairs = new Map<string, number>();
  for (const e of Object.values(w.edges)) {
    if (!live(e) || e.hypothesis || !live(w.steps[e.from]) || !live(w.steps[e.to])) continue;
    const a = procOf(e.from), b = procOf(e.to); if (!a || !b || a === b) continue;
    const key = a < b ? a + "|" + b : b + "|" + a; pairs.set(key, (pairs.get(key) || 0) + 1);
  }
  const links = [...pairs.entries()].map(([k, n]) => { const [a, b] = k.split("|"); return { a, b, n }; }).sort((x, y) => y.n - x.n).slice(0, 400);
  const listed = listedIds(curated);
  const questions = Object.values(w.edges).filter(e => e.hypothesis && live(e) && listed.has(e.id)).map(e => ({ id: e.id, a: shownAs(e.from), b: shownAs(e.to), t: ((curated as { id: string; title?: string }[]).find(c => c.id === e.id)?.title) || e.hypothesis!.prediction.slice(0, 100) }));
  const data: AtlasData = { root, links, questions, counts: { processes: Object.values(w.processes).length, steps: Object.values(w.steps).filter(s => live(s)).length } };
  return <div className="at-page"><Atlas data={data} /></div>;
}
