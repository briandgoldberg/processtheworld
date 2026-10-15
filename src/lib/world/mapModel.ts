// Turns one process of the shared map into drawable geometry: swim lanes of participants on top, resource lanes
// below, steps in columns that follow the forward flow, lines weighted by impact, and arrows from each step down
// to the resources it uses. The layout rules are the same ones the rest of the site has always used.
import type { Edge, Step, World } from "./types";
import { net } from "./engine";
import { ROLE_LABEL, roleOf, type Role } from "./roles";

const L = { HEAD: 150, COL: 200, BOXW: 160, BOXH: 62, ROWGAP: 16, PADX: 28, PADY: 16, BAND: 22, CHIPW: 138, CHIPH: 30 };
const MAX_PEOPLE = 5, MAX_RES = 5;

type LaneT = { id: string; name: string; kind: "participant" | "resource"; key: string; y: number; h: number };
export type NodeM = {
  id: string; label: string; kind: Step["kind"]; x: number; y: number; w: number; h: number; lane: string; by: string;
  sub?: string; up: number; down: number; status: string; uses: string[]; lines: string[]; crossTo: { id: string; process: string; title: string; label: string }[];
  participants: string[]; resources: string[]; resourceUse: { name: string; role: Role; inferred: boolean }[]; evidence: Step["evidence"]; col: number; evidenceCount: number;
  out: { edge: string; to: string; toLabel: string; prob?: number; impact: Edge["impact"]; loop?: Edge["loop"]; label: string }[];
  inc: { edge: string; from: string; fromLabel: string; fromProcess: string }[];
};
export type EdgeM = {
  id: string; d: string; lx: number; ly: number; label: string; prob?: number; loop: boolean; back: boolean; size: number; dir: string; hyp: boolean; by: string;
  from: string; to: string; fromLabel: string; toLabel: string; rawLabel: string; impact: Edge["impact"]; loopInfo?: Edge["loop"]; evidence: Edge["evidence"]; up: number; down: number;
  hypothesis?: Edge["hypothesis"];
};
export type ChipM = { id: string; lane: string; name: string; x: number; y: number; w: number; h: number; key: string };
export type ArrowM = { d: string; step: string; chip: string; role: Role; label: string; lx: number; ly: number; name: string };
export type MapModel = {
  id: string; title: string; description?: string; boundary?: { start?: string; end?: string }; boundarySteps: { start: string; ends: string[] };
  parent: { id: string; title: string } | null; crumbs: { id: string; title: string }[];
  children: { id: string; title: string; stepId: string; steps: number }[];
  width: number; height: number;
  lanes: { id: string; name: string; kind: string; key: string; y: number; h: number }[]; bands: { y: number; t: string }[];
  nodes: NodeM[]; edges: EdgeM[]; chips: ChipM[]; arrows: ArrowM[];
};

const wrap = (text: string, max: number, lines: number): string[] => {
  const words = text.replace(/\s+/g, " ").trim().split(" ").flatMap(w => (w.length > max ? w.match(new RegExp(".{1," + (max - 1) + "}", "g"))!.map((p, i, a) => (i < a.length - 1 ? p + "-" : p)) : [w]));
  const out: string[] = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) out.push(cur);
  if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1].replace(/.{0,2}$/, "") + "…"; }
  return out;
};

/** Which column each step sits in; arrows that loop back are ignored so a loop never drags steps to the start. */
function columns(ids: string[], next: Record<string, string[]>): Record<string, number> {
  const set = new Set(ids);
  const out: Record<string, string[]> = {}; const hasPred = new Set<string>();
  ids.forEach(id => { out[id] = (next[id] || []).filter(t => set.has(t)); out[id].forEach(t => hasPred.add(t)); });
  const back = new Set<string>(), state: Record<string, number> = {};
  const dfs = (id: string) => { state[id] = 1; for (const t of out[id]) { if (state[t] === 1) back.add(id + ">" + t); else if (!state[t]) dfs(t); } state[id] = 2; };
  ids.filter(id => !hasPred.has(id)).forEach(id => { if (!state[id]) dfs(id); });
  ids.forEach(id => { if (!state[id]) dfs(id); });
  const preds: Record<string, string[]> = {}; ids.forEach(id => (preds[id] = []));
  ids.forEach(id => out[id].forEach(t => { if (!back.has(id + ">" + t)) preds[t].push(id); }));
  const col: Record<string, number> = {};
  const depth = (id: string, guard = 0): number => (id in col ? col[id] : guard > 400 ? 0 : (col[id] = preds[id].reduce((d, p) => Math.max(d, depth(p, guard + 1) + 1), 0)));
  ids.forEach(id => depth(id));
  return col;
}

export function buildMap(w: World, pid: string): MapModel | null {
  const p = w.processes[pid]; if (!p) return null;
  const visible = (s: { status: string }) => s.status === "live";
  const steps = Object.values(w.steps).filter(s => s.process === pid && visible(s));
  const ids = steps.map(s => s.id), idset = new Set(ids);
  const edgesAll = Object.values(w.edges).filter(visible);
  const edges = edgesAll.filter(e => idset.has(e.from) && idset.has(e.to));
  const next: Record<string, string[]> = {}; edges.forEach(e => (next[e.from] ||= []).push(e.to));
  const col = columns(ids, next);

  // lanes
  const cnt = (key: "participants" | "resources") => {
    const m = new Map<string, { name: string; n: number }>();
    for (const s of steps) for (const n of s[key]) { const k = n.toLowerCase(); const e = m.get(k) || { name: n, n: 0 }; e.n++; m.set(k, e); }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, key === "participants" ? MAX_PEOPLE : MAX_RES);
  };
  const people = cnt("participants"), resources = cnt("resources");
  const laneOfStep = (s: Step) => { const i = people.findIndex(([k]) => s.participants.some(n => n.toLowerCase() === k)); return i < 0 ? "lo" : "l" + i; };
  const laneList: { id: string; name: string; kind: "participant" | "resource"; key: string }[] = [
    ...people.map(([k, v], i) => ({ id: "l" + i, name: v.name, kind: "participant" as const, key: k })),
    { id: "lo", name: "Other participants", kind: "participant" as const, key: "" },
    ...resources.map(([k, v], i) => ({ id: "r" + i, name: v.name, kind: "resource" as const, key: k })),
  ].filter(l => l.id !== "lo" || steps.some(s => laneOfStep(s) === "lo"));

  // rows per lane/column
  const slot: Record<string, number> = {}, rowOf: Record<string, number> = {}, rows: Record<string, number> = {};
  steps.forEach(s => { const lane = laneOfStep(s); const k = lane + "|" + col[s.id]; rowOf[s.id] = slot[k] = (slot[k] ?? -1) + 1; rows[lane] = Math.max(rows[lane] || 1, rowOf[s.id] + 1); });
  const maxCol = Math.max(0, ...Object.values(col));
  const width = L.HEAD + L.PADX * 2 + (maxCol + 1) * L.COL;
  const firstRes = laneList.findIndex(l => l.kind === "resource");
  let y = 0; const bands: { y: number; t: string }[] = []; const lanes: LaneT[] = [];
  laneList.forEach((l, i) => {
    if (i === 0) { bands.push({ y, t: "Participants" }); y += L.BAND; }
    if (i === firstRes) { bands.push({ y, t: "Resources" }); y += L.BAND; }
    const h = (l.kind === "resource" ? 1 : rows[l.id] || 1) * (L.BOXH + L.ROWGAP) + L.PADY * 2 - L.ROWGAP + 8;
    lanes.push({ ...l, y, h }); y += h;
  });
  const laneBy = new Map(lanes.map(l => [l.id, l]));
  const xOf = (c: number) => L.HEAD + L.PADX + c * L.COL;
  const pos: Record<string, { x: number; y: number }> = {};
  steps.forEach(s => { const lane = laneBy.get(laneOfStep(s))!; pos[s.id] = { x: xOf(col[s.id]), y: lane.y + L.PADY + rowOf[s.id] * (L.BOXH + L.ROWGAP) }; });

  // resource chips: one per lane and column, with an arrow from every step in that column that uses the resource
  const chips: ChipM[] = []; const arrows: ArrowM[] = []; const chipAt = new Map<string, ChipM>();
  const usesOf: Record<string, string[]> = {};
  for (const s of steps) {
    usesOf[s.id] = [];
    for (const [i, [k]] of resources.entries()) {
      if (!s.resources.some(n => n.toLowerCase() === k)) continue;
      const lane = laneBy.get("r" + i); if (!lane) continue;
      usesOf[s.id].push(lane.id);
      const ck = lane.id + "|" + col[s.id];
      let chip = chipAt.get(ck);
      if (!chip) {
        chip = { id: ck, lane: lane.id, name: lane.name, x: xOf(col[s.id]) + (L.BOXW - L.CHIPW) / 2, y: lane.y + (lane.h - L.CHIPH) / 2, w: L.CHIPW, h: L.CHIPH, key: k };
        chipAt.set(ck, chip); chips.push(chip);
      }
      const x1 = pos[s.id].x + L.BOXW / 2 + (usesOf[s.id].length - 1) * 8, y1 = pos[s.id].y + L.BOXH, x2 = chip.x + chip.w / 2 + (usesOf[s.id].length - 1) * 8 - 8, y2 = chip.y;
      const { role } = roleOf(s, lane.name);
      // inputs and mechanisms run from the resource up into the step; outputs run from the step down to the resource
      const d = role === "produced" ? `M${x1} ${y1} C${x1} ${y1 + 26} ${x2} ${y2 - 26} ${x2} ${y2}` : `M${x2} ${y2} C${x2} ${y2 - 26} ${x1} ${y1 + 26} ${x1} ${y1}`;
      arrows.push({ d, step: s.id, chip: chip.id, role, label: ROLE_LABEL[role], lx: (x1 + x2) / 2, ly: (y1 + y2) / 2, name: lane.name });
    }
  }

  // lines
  const edgeModels: EdgeM[] = edges.map(e => {
    const a = pos[e.from], b = pos[e.to];
    const forward = col[e.to] > col[e.from];
    let d: string, lx: number, ly: number;
    if (forward) {
      const x1 = a.x + L.BOXW, y1 = a.y + L.BOXH / 2, x2 = b.x, y2 = b.y + L.BOXH / 2, mx = (x1 + x2) / 2;
      d = `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`; lx = mx; ly = (y1 + y2) / 2;
    } else {
      const x1 = a.x + L.BOXW / 2, y1 = a.y - 2, x2 = b.x + L.BOXW / 2, y2 = b.y - 2, dy = 38;
      d = `M${x1} ${y1} C${x1} ${y1 - dy} ${x2} ${y2 - dy} ${x2} ${y2}`; lx = (x1 + x2) / 2; ly = Math.min(y1, y2) - dy * 0.75;
    }
    const label = [e.prob != null ? `${e.prob}%` : "", e.loop ? `↻ ${e.loop.kind === "reinforcing" ? "reinforces" : "balances"} · ${e.loop.strength} · ${e.loop.gain}` : "", e.label].filter(Boolean).join(" ").slice(0, e.loop ? 44 : 28);
    const nv = net(w, e.id, e.by);
    return { id: e.id, d, lx, ly, label, prob: e.prob, loop: !!e.loop, back: !forward, size: e.impact.size, dir: e.impact.direction, hyp: !!e.hypothesis, by: e.by, from: e.from, to: e.to, fromLabel: w.steps[e.from]?.label || e.from, toLabel: w.steps[e.to]?.label || e.to, rawLabel: e.label, impact: e.impact, loopInfo: e.loop, evidence: e.evidence, up: nv.up, down: nv.down, hypothesis: e.hypothesis };
  });

  // nodes
  const stepLabel = (id: string) => w.steps[id]?.label || id;
  const nodes: NodeM[] = steps.map(s => {
    const lane = laneBy.get(laneOfStep(s))!;
    const n = net(w, s.id, s.by);
    const crossTo = edgesAll.filter(e => e.from === s.id && !idset.has(e.to) && w.steps[e.to] && visible(w.steps[e.to])).slice(0, 6).map(e => ({ id: e.to, process: w.steps[e.to].process, title: w.processes[w.steps[e.to].process]?.title || "", label: stepLabel(e.to) }));
    return {
      id: s.id, label: s.label, kind: s.kind, x: pos[s.id].x, y: pos[s.id].y, w: L.BOXW, h: L.BOXH, lane: lane.id, by: s.by, sub: s.sub && w.processes[s.sub] ? s.sub : undefined,
      up: n.up, down: n.down, status: s.status, uses: usesOf[s.id], lines: wrap(s.label, 23, 3), crossTo, participants: s.participants, resources: s.resources, resourceUse: s.resources.map(r => { const x = roleOf(s, r); return { name: r, role: x.role, inferred: x.inferred }; }), evidence: s.evidence, col: col[s.id], evidenceCount: s.evidence.length,
      out: edges.filter(e => e.from === s.id).map(e => ({ edge: e.id, to: e.to, toLabel: stepLabel(e.to), prob: e.prob, impact: e.impact, loop: e.loop, label: e.label })),
      inc: edgesAll.filter(e => e.to === s.id && w.steps[e.from]).map(e => ({ edge: e.id, from: e.from, fromLabel: stepLabel(e.from), fromProcess: w.steps[e.from].process })),
    };
  });

  const crumbs: { id: string; title: string }[] = []; let cur = p;
  while (cur) { crumbs.unshift({ id: cur.id, title: cur.title }); cur = cur.parentStep ? w.processes[w.steps[cur.parentStep]?.process] : (undefined as never); }
  const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2] : null;
  const children = steps.filter(s => s.sub && w.processes[s.sub]).map(s => ({ id: s.sub!, title: w.processes[s.sub!].title, stepId: s.id, steps: Object.values(w.steps).filter(x => x.process === s.sub && x.kind !== "start" && x.kind !== "end" && visible(x)).length }));
  return { id: pid, title: p.title, description: p.description, boundary: p.boundary, boundarySteps: { start: stepLabel(p.start), ends: (p.ends || []).map(stepLabel) }, parent, crumbs, children, width, height: Math.max(y, 80) + 8, lanes: lanes.map(l => ({ id: l.id, name: l.name, kind: l.kind, key: l.key, y: l.y, h: l.h })), bands, nodes, edges: edgeModels, chips, arrows };
}
export const BOX = L;
