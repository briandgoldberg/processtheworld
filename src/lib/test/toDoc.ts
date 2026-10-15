// Turns the /test world into the app's process document, so the main page's swim-lane drawing (flowHtml) can draw it.
// One layer per process. Lanes are the layer's most common participants. A subprocess step opens its own layer.
import world from "./world.json";

type W = {
  meta: { title: string };
  processes: Record<string, { id: string; title: string; parentStep: string | null }>;
  steps: Record<string, { id: string; process: string; label: string; kind: string; participants: string[]; resources: string[]; status: string; sub?: string }>;
  edges: Record<string, { from: string; to: string; label: string; prob?: number; loop?: { kind: string; strength: string; gain: number }; status: string }>;
};
const W = world as unknown as W;
const mapId = (p: string) => (p === "p0" ? "m_root" : p);
const MAX_LANES = 5;
const MAX_RES = 4;

export function worldDoc() {
  const steps = Object.values(W.steps).filter(s => s.status !== "removed");
  const edges = Object.values(W.edges).filter(e => e.status !== "removed");
  const maps: Record<string, unknown> = {};
  for (const p of Object.values(W.processes)) {
    const mine = steps.filter(s => s.process === p.id);
    if (!mine.length) continue;
    const rank = (key: "participants" | "resources", max: number) => {
      const count = new Map<string, { name: string; n: number }>();
      for (const s of mine) for (const n of s[key]) { const k = n.toLowerCase(); const e = count.get(k) || { name: n, n: 0 }; e.n++; count.set(k, e); }
      return [...count.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, max);
    };
    const top = rank("participants", MAX_LANES), res = rank("resources", MAX_RES);
    const lanes = [
      ...top.map(([, v], i) => ({ id: "l" + i, name: v.name, type: "person" })),
      { id: "lo", name: "Other participants", type: "person" },
      ...res.map(([, v], i) => ({ id: "r" + i, name: v.name, type: "system" })),
    ];
    const laneOf = (s: { participants: string[] }) => { const i = top.findIndex(([k]) => s.participants.some(n => n.toLowerCase() === k)); return i < 0 ? "lo" : "l" + i; };
    const usesOf = (s: { resources: string[] }) => res.flatMap(([k], i) => (s.resources.some(n => n.toLowerCase() === k) ? ["r" + i] : []));
    const ids = new Set(mine.map(s => s.id));
    maps[mapId(p.id)] = {
      id: mapId(p.id),
      title: p.title,
      parent: p.parentStep ? { map: mapId(W.steps[p.parentStep].process), step: p.parentStep } : null,
      lanes,
      steps: mine.map(s => {
        const out = edges.filter(e => e.from === s.id);
        const next = out.filter(e => ids.has(e.to)).map(e => ({ to: e.to, label: [e.prob != null ? `${e.prob}%` : "", e.loop ? "↻" : "", e.label].filter(Boolean).join(" ") }));
        const cross = out.find(e => !ids.has(e.to) && W.steps[e.to] && W.steps[e.to].status !== "removed");
        if (cross) next.push({ to: cross.to, label: "", map: mapId(W.steps[cross.to].process) } as { to: string; label: string });
        return {
          id: s.id,
          lane: laneOf(s),
          uses: usesOf(s),
          label: s.label,
          kind: s.kind === "fork" ? "decision" : s.kind === "step" ? "task" : s.kind,
          next,
          child: s.sub && W.processes[s.sub] ? mapId(s.sub) : undefined,
        };
      }),
    };
  }
  return { title: W.meta.title, maps };
}
