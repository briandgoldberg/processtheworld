// A compact format for agents to describe a process. Converted here into the
// full document the app stores, with every reference checked so the map renders.

import { cleanTags } from "./tags";

type In = Record<string, any>;
const KINDS = ["start", "task", "decision", "subprocess", "end"];
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const ident = (v: unknown) => /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(String(v ?? "")) ? String(v) : null;

/** A pain point is where a step hurts: slow, error-prone, manual, costly. "pain" is a note, or { level: 1-3, note }. */
function parsePain(v: unknown): { level: number; note: string } | null {
  if (typeof v === "string" && v.trim()) return { level: 2, note: clip(v, 200) };
  if (v && typeof v === "object") {
    const o = v as In, level = Math.max(1, Math.min(3, Math.round(Number(o.level)) || 2)), note = clip(o.note, 200);
    return { level, note };
  }
  return null;
}

function buildMap(id: string, title: string, parent: { map: string; step: string } | null, raw: In, errors: string[], where: string) {
  const lanes = Array.isArray(raw.lanes) ? raw.lanes.slice(0, 20) : [];
  const steps = Array.isArray(raw.steps) ? raw.steps.slice(0, 200) : [];
  if (!lanes.length) errors.push(`${where}: "lanes" needs at least one lane`);
  if (!steps.length) errors.push(`${where}: "steps" needs at least one step`);
  const laneIds = new Set<string>(), stepIds = new Set<string>();
  const outLanes = lanes.map((l: In, i: number) => {
    const lid = ident(l.id);
    if (!lid) errors.push(`${where}: lane ${i + 1} needs an "id" of letters, numbers, - or _ (starting with a letter)`);
    else if (laneIds.has(lid)) errors.push(`${where}: duplicate lane id "${lid}"`);
    else laneIds.add(lid);
    if (!clip(l.name, 60)) errors.push(`${where}: lane "${lid}" needs a "name"`);
    return { id: lid || `lane${i}`, name: clip(l.name, 60), type: l.type === "system" ? "system" : "person" };
  });
  steps.forEach((s: In, i: number) => { const sid = ident(s.id); if (!sid) errors.push(`${where}: step ${i + 1} needs an "id" of letters, numbers, - or _ (starting with a letter)`); else if (stepIds.has(sid)) errors.push(`${where}: duplicate step id "${sid}"`); else stepIds.add(sid); });
  const outSteps = steps.map((s: In, i: number) => {
    const sid = ident(s.id) || `s${i}`;
    if (!laneIds.has(String(s.lane))) errors.push(`${where}: step "${sid}" uses unknown lane "${s.lane}"`);
    const link = typeof s.link === "string" && /^[A-Za-z0-9_-]{3,64}$/.test(s.link) ? s.link : null;
    if (s.link && !link) errors.push(`${where}: step "${sid}" has a "link" that isn't a process id`);
    const kind = link ? "subprocess" : KINDS.includes(s.kind) ? s.kind : "task";
    const uses = (Array.isArray(s.uses) ? s.uses : []).map(String).filter(u => { if (!laneIds.has(u)) { errors.push(`${where}: step "${sid}" "uses" unknown lane "${u}"`); return false; } return true; });
    const next = (Array.isArray(s.next) ? s.next : []).slice(0, 8).map((n: In | string) => {
      const o: In = typeof n === "string" ? { to: n } : n;
      if (!stepIds.has(String(o.to))) errors.push(`${where}: step "${sid}" goes to unknown step "${o.to}"`);
      return { to: String(o.to), ...(clip(o.label, 80) ? { label: clip(o.label, 80) } : {}) };
    });
    if (!clip(s.label, 160)) errors.push(`${where}: step "${sid}" needs a "label"`);
    const pain = parsePain(s.pain);
    return { id: sid, lane: String(s.lane), label: clip(s.label, 160), kind, uses, next, ...(link ? { link: { id: link } } : {}), ...(pain ? { pain } : {}) };
  });
  return { id, title, parent, lanes: outLanes, steps: outSteps };
}

/** Input: { title, lanes, steps, layers?: [{ id, title, parentStep, lanes, steps }] } */
export function buildDoc(input: In): { doc?: In; errors: string[] } {
  const errors: string[] = [];
  const title = clip(input.title, 200);
  if (!title) errors.push('"title" is required');
  const maps: Record<string, any> = {};
  maps.m_root = buildMap("m_root", title, null, input, errors, "main layer");
  const layers = Array.isArray(input.layers) ? input.layers.slice(0, 30) : [];
  layers.forEach((l: In, i: number) => {
    const lid = ident(l.id);
    if (!lid) { errors.push(`layer ${i + 1} needs an "id"`); return; }
    const mapId = `m_${lid}`;
    const parentLayer = l.parentLayer ? `m_${l.parentLayer}` : "m_root";
    maps[mapId] = buildMap(mapId, clip(l.title, 200) || lid, { map: parentLayer, step: String(l.parentStep) }, l, errors, `layer "${lid}"`);
  });
  for (const m of Object.values(maps)) {
    if (!m.parent) continue;
    const owner = maps[m.parent.map];
    const step = owner?.steps.find((s: In) => s.id === m.parent.step);
    if (!step) errors.push(`layer "${m.id.slice(2)}": parentStep "${m.parent.step}" not found in ${m.parent.map === "m_root" ? "the main layer" : `layer "${m.parent.map.slice(2)}"`}`);
    else { step.kind = "subprocess"; step.child = m.id; }
  }
  if (errors.length) return { errors };
  const all = Object.values(maps);
  const depth = (id: string, n = 1): number => { const p = maps[id]?.parent; return p ? depth(p.map, n + 1) : n; };
  return {
    errors,
    doc: { title, status: "done", tags: cleanTags(input.tags), maps, chat: [], events: [], stepCount: all.reduce((n, m) => n + m.steps.length, 0), depth: Math.max(...all.map(m => depth(m.id))), laneTypes: [...new Set(maps.m_root.lanes.map((l: In) => l.type))] },
  };
}
