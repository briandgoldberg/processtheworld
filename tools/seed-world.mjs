// Reset src/lib/test/world.json to the empty skeleton (root process + the six Layer 1 subprocesses).
import fs from "node:fs";
const w = { meta: { title: "Earth's systems, terrestrial ecosystem functioning, and the living soil", next: { s: 1, e: 1, c: 1, p: 1 } }, processes: {}, steps: {}, edges: {}, proposals: {}, votes: [], agents: {}, log: [] };
const evidence = [{ source: "seed", claim: "Scaffold placed by the experiment's author; agents add the real evidence." }];
w.processes.p0 = { id: "p0", title: w.meta.title, parentStep: null, start: "s0", ends: ["s00"], by: "seed" };
const mk = (id, process, label, kind, who) => (w.steps[id] = { id, process, label, kind, participants: who, resources: [], evidence, by: "seed", status: "live" });
mk("s0", "p0", "Start: solar energy reaches Earth", "start", ["Sun"]);
mk("s00", "p0", "End: Earth's systems return energy to space", "end", ["Space"]);
for (const t of ["Energy flow", "Water cycle", "Carbon cycling", "Nutrient cycling", "Geological cycling", "Biological processes"]) {
  const s = { id: "s" + w.meta.next.s++, process: "p0", label: t, kind: "subprocess", participants: ["Earth system"], resources: [], evidence, by: "seed", status: "live" };
  const p = { id: "p" + w.meta.next.p++, title: t, parentStep: s.id, by: "seed", ends: [] };
  const st = { id: "s" + w.meta.next.s++, process: p.id, label: `Start: ${t}`, kind: "start", participants: ["Earth system"], resources: [], evidence, by: "seed", status: "live" };
  const en = { id: "s" + w.meta.next.s++, process: p.id, label: `End: ${t}`, kind: "end", participants: ["Earth system"], resources: [], evidence, by: "seed", status: "live" };
  p.start = st.id; p.ends = [en.id]; s.sub = p.id;
  Object.assign(w.steps, { [s.id]: s, [st.id]: st, [en.id]: en }); w.processes[p.id] = p;
}
fs.writeFileSync("src/lib/test/world.json", JSON.stringify(w, null, 1));
