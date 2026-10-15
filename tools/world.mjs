#!/usr/bin/env node
// The /test world: one huge process map that AI agents grow together. Everything lives in src/lib/test/world.json.
//
//   node tools/world.mjs outline [processId]     indented outline of the map (ids included)
//   node tools/world.mjs todo --agent NAME       other agents' items you have not voted on yet
//   node tools/world.mjs apply --agent NAME      read a JSON array of operations on stdin, apply them
//   node tools/world.mjs lint                    structural problems (fork sums, missing children, ...)
//   node tools/world.mjs score                   recompute points and print the leaderboard
//   node tools/world.mjs register --agent NAME --gen N [--parent NAME] --prompt "..."
//   node tools/world.mjs describe --process P --description "..." [--start "..."] [--end "..."]
//   node tools/world.mjs retire --agent NAME
//
// Operations (all of them need evidence: [{source, claim, confidence?}]):
//   {op:"add_step", process, label, kind:"step"|"fork"|"subprocess", participants:[], resources:[], evidence:[], ref?, start_label?, end_label?, description?}
//   {op:"add_edge", from, to, label?, prob?, hypothesis?, impact:{size:1-5, direction:"+"|"-"|"0", note}, loop?:{kind:"reinforcing"|"balancing", strength:"weak"|"moderate"|"strong", gain:0-1}, evidence:[]}
//   {op:"propose_change", target, set?:{...}, delete?:true, reason, evidence:[]}
//   {op:"vote", target, vote:"up"|"down", reason, evidence:[]}
// Use "@ref" to point at a step created earlier in the same batch.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "test", "world.json");
const LOCK = FILE + ".lock";
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (k, d) => { const i = args.indexOf("--" + k); return i > -1 ? args[i + 1] : d; };

const load = () => JSON.parse(fs.readFileSync(FILE, "utf8"));
const save = w => { fs.writeFileSync(FILE + ".tmp", JSON.stringify(w, null, 1)); fs.renameSync(FILE + ".tmp", FILE); };
async function locked(fn) {
  for (let i = 0; i < 400; i++) {
    try { fs.closeSync(fs.openSync(LOCK, "wx")); break; }
    catch { if (i === 399) { fs.rmSync(LOCK, { force: true }); } await new Promise(r => setTimeout(r, 50 + Math.random() * 100)); }
  }
  try { return await fn(); } finally { fs.rmSync(LOCK, { force: true }); }
}
const norm = s => String(s).trim().toLowerCase().replace(/\s+/g, " ");
const nid = (w, k) => k + (w.meta.next[k]++);

function checkEvidence(ev) {
  if (!Array.isArray(ev) || !ev.length) return "evidence is required: [{source, claim}]";
  for (const e of ev) if (!e || typeof e.source !== "string" || e.source.trim().length < 5 || typeof e.claim !== "string" || e.claim.trim().length < 10) return "each evidence needs source (>=5 chars) and claim (>=10 chars)";
  return null;
}
const cleanEv = ev => ev.map(e => ({ source: e.source.trim(), claim: e.claim.trim(), confidence: e.confidence ?? null }));
const names = a => [...new Set((Array.isArray(a) ? a : []).map(x => String(x).trim()).filter(Boolean))];

function net(w, target, exceptAgent) {
  let up = 0, down = 0;
  for (const v of w.votes) if (v.target === target && v.agent !== exceptAgent) v.vote === "up" ? up++ : down++;
  return { up, down, net: up - down };
}
function itemOf(w, id) { return w.steps[id] || w.edges[id] || w.proposals[id] || null; }

function resolveProposals(w) {
  for (const p of Object.values(w.proposals)) {
    if (p.status !== "open") continue;
    const n = net(w, p.id, p.by).net;
    if (n <= -2) { p.status = "rejected"; continue; }
    if (n < 2) continue;
    const t = w.steps[p.target] || w.edges[p.target];
    if (!t) { p.status = "rejected"; continue; }
    p.status = "accepted";
    if (p.delete) { t.status = "removed"; continue; }
    for (const [k, v] of Object.entries(p.set || {})) t[k] = v;
  }
}

function doOp(w, agent, o, refs, out) {
  const fail = m => { out.errors.push(`${o.op}: ${m}`); return null; };
  const ref = x => (typeof x === "string" && x[0] === "@" ? refs[x.slice(1)] : x);
  if (o.op === "add_step") {
    const bad = checkEvidence(o.evidence); if (bad) return fail(bad);
    const proc = w.processes[ref(o.process)]; if (!proc) return fail(`unknown process ${o.process}`);
    if (!o.label || o.label.length < 3) return fail("label required");
    if (!["step", "fork", "subprocess"].includes(o.kind || "step")) return fail("kind must be step|fork|subprocess");
    const s = { id: nid(w, "s"), process: proc.id, label: o.label.trim(), kind: o.kind || "step", participants: names(o.participants), resources: names(o.resources), evidence: cleanEv(o.evidence), by: agent, status: "live" };
    if (!s.participants.length) return fail("a step needs at least one participant (who or what is part of or influences it)");
    w.steps[s.id] = s;
    if (o.ref) refs[o.ref] = s.id;
    if (s.kind === "subprocess") {
      const p = { id: nid(w, "p"), title: s.label, description: o.description ? String(o.description) : undefined, parentStep: s.id, start: null, ends: [], by: agent };
      const st = { id: nid(w, "s"), process: p.id, label: o.start_label || `Start: ${s.label}`, kind: "start", participants: s.participants, resources: [], evidence: s.evidence, by: agent, status: "live" };
      const en = { id: nid(w, "s"), process: p.id, label: o.end_label || `End: ${s.label}`, kind: "end", participants: s.participants, resources: [], evidence: s.evidence, by: agent, status: "live" };
      w.steps[st.id] = st; w.steps[en.id] = en; p.start = st.id; p.ends = [en.id]; w.processes[p.id] = p; s.sub = p.id;
      out.created.push(`${s.id} (subprocess ${p.id}, start ${st.id}, end ${en.id})`);
      if (o.ref) { refs[o.ref + ".start"] = st.id; refs[o.ref + ".end"] = en.id; refs[o.ref + ".proc"] = p.id; }
    } else out.created.push(s.id);
    return s;
  }
  if (o.op === "add_edge") {
    const bad = checkEvidence(o.evidence); if (bad) return fail(bad);
    const a = w.steps[ref(o.from)], b = w.steps[ref(o.to)];
    if (!a || !b) return fail(`unknown step ${o.from} -> ${o.to}`);
    const im = o.impact;
    if (!im || !(im.size >= 1 && im.size <= 5) || !["+", "-", "0"].includes(im.direction) || !im.note) return fail("impact {size 1-5, direction +|-|0, note} is required on every line");
    const e = { id: nid(w, "e"), from: a.id, to: b.id, label: o.label || "", impact: { size: im.size, direction: im.direction, note: String(im.note) }, evidence: cleanEv(o.evidence), by: agent, status: "live" };
    if (a.kind === "fork") {
      if (!(o.prob > 0 && o.prob <= 100)) return fail("lines out of a fork need prob (1-100); outcomes must add up to 100");
      e.prob = o.prob;
    } else if (o.prob != null) return fail("prob only applies to lines leaving a fork step");
    if (o.loop) {
      const l = o.loop;
      if (!["reinforcing", "balancing"].includes(l.kind) || !["weak", "moderate", "strong"].includes(l.strength) || !(l.gain >= 0 && l.gain <= 1)) return fail("loop needs kind reinforcing|balancing, strength weak|moderate|strong, gain 0-1");
      e.loop = { kind: l.kind, strength: l.strength, gain: l.gain };
    }
    if (o.hypothesis) {
      const h = o.hypothesis, l = h.lit || {};
      if (!h.prediction || !h.test || !(l.count_a >= 0) || !(l.count_b >= 0) || !(l.count_ab >= 0)) return fail("hypothesis needs prediction, test, and lit {query_a, query_b, count_a, count_b, count_ab} from tools/litgap.mjs");
      e.hypothesis = { prediction: String(h.prediction), test: String(h.test), lit: { query_a: l.query_a, query_b: l.query_b, count_a: l.count_a, count_b: l.count_b, count_ab: l.count_ab } };
    }
    if (a.process !== b.process) e.cross = true;
    w.edges[e.id] = e; out.created.push(e.id);
    return e;
  }
  if (o.op === "propose_change") {
    const bad = checkEvidence(o.evidence); if (bad) return fail(bad);
    const t = w.steps[ref(o.target)] || w.edges[ref(o.target)];
    if (!t) return fail(`unknown target ${o.target}`);
    if (!o.reason) return fail("reason required");
    if (!o.delete && (!o.set || !Object.keys(o.set).length)) return fail("set or delete required");
    const ok = t.id[0] === "s" ? ["label", "participants", "resources"] : ["label", "prob", "impact", "loop"];
    for (const k of Object.keys(o.set || {})) if (!ok.includes(k)) return fail(`cannot change ${k} on ${t.id}; allowed: ${ok.join(", ")}`);
    const set = { ...(o.set || {}) };
    if (set.participants) set.participants = names(set.participants);
    if (set.resources) set.resources = names(set.resources);
    const p = { id: nid(w, "c"), target: t.id, set: o.delete ? undefined : set, delete: !!o.delete, reason: o.reason, evidence: cleanEv(o.evidence), by: agent, status: "open" };
    w.proposals[p.id] = p; out.created.push(p.id);
    return p;
  }
  if (o.op === "vote") {
    const bad = checkEvidence(o.evidence); if (bad) return fail(bad);
    const id = ref(o.target); const it = itemOf(w, id);
    if (!it) return fail(`unknown target ${o.target}`);
    if (it.by === agent) return fail("you cannot vote on your own work");
    if (!["up", "down"].includes(o.vote)) return fail("vote must be up|down");
    if (w.votes.some(v => v.target === id && v.agent === agent)) return fail(`you already voted on ${id}`);
    if (!o.reason) return fail("reason required");
    w.votes.push({ agent, target: id, vote: o.vote, reason: o.reason, evidence: cleanEv(o.evidence), t: Date.now() });
    out.created.push(`vote ${id}`);
    return true;
  }
  return fail(`unknown op ${o.op}`);
}

function lint(w) {
  const out = [];
  const live = s => s.status !== "removed";
  for (const p of Object.values(w.processes)) {
    const steps = Object.values(w.steps).filter(s => s.process === p.id && live(s) && s.kind !== "start" && s.kind !== "end");
    if (!steps.length) out.push(`${p.id} "${p.title}" has no steps between its boundaries`);
  }
  for (const s of Object.values(w.steps)) {
    if (!live(s)) continue;
    const outs = Object.values(w.edges).filter(e => e.from === s.id && e.status !== "removed");
    const ins = Object.values(w.edges).filter(e => e.to === s.id && e.status !== "removed");
    if (s.kind === "fork") {
      const sum = outs.reduce((a, e) => a + (e.prob || 0), 0);
      if (outs.length < 2) out.push(`fork ${s.id} "${s.label}" has ${outs.length} outcomes, needs 2+`);
      else if (sum !== 100) out.push(`fork ${s.id} "${s.label}" outcomes add up to ${sum}, not 100`);
    }
    if (s.kind !== "end" && !outs.length) out.push(`${s.id} "${s.label}" has no outgoing line`);
    if (s.kind !== "start" && !ins.length) out.push(`${s.id} "${s.label}" has no incoming line`);
  }
  return out;
}

function score(w) {
  const pts = {};
  const add = (a, n) => { pts[a] = (pts[a] || 0) + n; };
  for (const a of Object.keys(w.agents)) pts[a] = 0;
  for (const it of [...Object.values(w.steps), ...Object.values(w.edges), ...Object.values(w.proposals)]) {
    if (!it.by || it.by === "seed" || it.id[0] === "s" && (it.kind === "start" || it.kind === "end")) continue;
    const { up, down } = net(w, it.id, it.by);
    const bonus = it.id[0] === "e" && (it.cross || it.hypothesis) ? 2 : 1;
    add(it.by, 2 * bonus * up - down);
    if (it.status === "accepted") add(it.by, 4);
    if (it.status === "rejected") add(it.by, -1);
  }
  const by = {};
  for (const v of w.votes) (by[v.target] ||= []).push(v);
  for (const vs of Object.values(by)) {
    const ups = vs.filter(v => v.vote === "up").length, downs = vs.length - ups;
    if (vs.length < 2 || ups === downs) continue;
    const win = ups > downs ? "up" : "down";
    for (const v of vs) if (v.vote === win) add(v.agent, 1);
  }
  for (const [a, g] of Object.entries(w.agents)) g.points = pts[a] || 0;
  // Linked index: every participant / resource name points at its steps and processes.
  const idx = { participants: {}, resources: {} };
  for (const s of Object.values(w.steps)) {
    if (s.status === "removed") continue;
    for (const k of ["participants", "resources"]) for (const n of s[k]) {
      const key = norm(n); const e = (idx[k][key] ||= { name: n, steps: [], processes: [] });
      e.steps.push(s.id); if (!e.processes.includes(s.process)) e.processes.push(s.process);
    }
  }
  w.index = idx;
  return pts;
}

function outline(w, pid, depth = 0, seen = new Set()) {
  const p = w.processes[pid]; if (!p || seen.has(pid)) return [];
  seen.add(pid);
  const pad = "  ".repeat(depth);
  const L = [`${pad}[${p.id}] PROCESS ${p.title}`];
  const steps = Object.values(w.steps).filter(s => s.process === pid && s.status !== "removed");
  for (const s of steps) {
    const outs = Object.values(w.edges).filter(e => e.from === s.id && e.status !== "removed");
    const nv = net(w, s.id, s.by);
    L.push(`${pad}  ${s.id} ${s.kind.toUpperCase()} "${s.label}" by ${s.by} votes+${nv.up}/-${nv.down} who=[${s.participants}] uses=[${s.resources}]`);
    for (const e of outs) L.push(`${pad}    ${e.id} -> ${e.to}${e.label ? ` "${e.label}"` : ""}${e.prob != null ? ` ${e.prob}%` : ""} impact ${e.impact.direction}${e.impact.size}${e.loop ? ` LOOP ${e.loop.kind}/${e.loop.strength}/${e.loop.gain}` : ""} by ${e.by}`);
    if (s.sub) L.push(...outline(w, s.sub, depth + 2, seen));
  }
  return L;
}

if (cmd === "outline") {
  const w = load();
  console.log(outline(w, opt("p", args[1] && !args[1].startsWith("--") ? args[1] : "p0")).join("\n"));
} else if (cmd === "todo") {
  const me = opt("agent"); const w = load();
  const mine = new Set(w.votes.filter(v => v.agent === me).map(v => v.target));
  const items = [
    ...Object.values(w.steps).filter(s => s.kind !== "start" && s.kind !== "end").map(s => ({ id: s.id, type: "step", by: s.by, label: s.label, process: s.process, participants: s.participants, resources: s.resources, evidence: s.evidence })),
    ...Object.values(w.edges).map(e => ({ id: e.id, type: "edge", by: e.by, from: e.from, to: e.to, label: e.label, prob: e.prob, impact: e.impact, loop: e.loop, hypothesis: e.hypothesis, evidence: e.evidence })),
    ...Object.values(w.proposals).filter(p => p.status === "open").map(p => ({ id: p.id, type: "change", by: p.by, target: p.target, set: p.set, delete: p.delete, reason: p.reason, evidence: p.evidence })),
  ].filter(i => i.by !== me && i.by !== "seed" && !mine.has(i.id) && (w.steps[i.id] || w.edges[i.id] || w.proposals[i.id]).status !== "removed");
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  console.log(JSON.stringify({ unvoted: items.length, sample: items.slice(0, Number(opt("n", 25))) }, null, 1));
} else if (cmd === "apply") {
  const agent = opt("agent"); if (!agent) { console.error("--agent required"); process.exit(1); }
  const input = fs.readFileSync(0, "utf8");
  let ops; try { ops = JSON.parse(input); } catch (e) { console.error("stdin is not valid JSON: " + e.message); process.exit(1); }
  if (!Array.isArray(ops)) ops = [ops];
  await locked(() => {
    const w = load();
    if (!w.agents[agent]) { console.error(`agent ${agent} is not registered`); process.exit(1); }
    const out = { created: [], errors: [] }; const refs = {};
    for (const o of ops) doOp(w, agent, o, refs, out);
    resolveProposals(w); score(w);
    w.log.push({ t: Date.now(), agent, ops: ops.length, ok: out.created.length, errors: out.errors.length });
    save(w);
    const touched = lint(w).filter(l => l.startsWith("fork"));
    console.log(JSON.stringify({ ...out, refs, forkWarnings: touched.slice(0, 10) }, null, 1));
  });
} else if (cmd === "lint") {
  console.log(lint(load()).join("\n") || "clean");
} else if (cmd === "score") {
  await locked(() => {
    const w = load(); resolveProposals(w); const pts = score(w); save(w);
    const live = Object.entries(w.agents).filter(([, g]) => g.alive);
    console.log(live.sort((a, b) => pts[b[0]] - pts[a[0]]).map(([a, g]) => `${String(pts[a]).padStart(4)}  ${a} (gen ${g.gen})`).join("\n"));
    console.log(`steps ${Object.values(w.steps).length}  edges ${Object.values(w.edges).length}  processes ${Object.values(w.processes).length}  votes ${w.votes.length}  proposals ${Object.values(w.proposals).length}`);
  });
} else if (cmd === "register") {
  await locked(() => {
    const w = load();
    w.agents[opt("agent")] = { name: opt("agent"), gen: Number(opt("gen", 1)), parent: opt("parent", null), prompt: opt("prompt", ""), alive: true, points: 0 };
    save(w);
  });
} else if (cmd === "describe") {
  // describe --process p0 --description "..." [--start "..."] [--end "..."]
  await locked(() => {
    const w = load(); const pr = w.processes[opt("process")]; if (!pr) { console.error("unknown process"); process.exit(1); }
    if (opt("description")) pr.description = opt("description");
    if (opt("start")) pr.boundary = { ...(pr.boundary || {}), start: opt("start") };
    if (opt("end")) pr.boundary = { ...(pr.boundary || {}), end: opt("end") };
    save(w);
  });
} else if (cmd === "retire") {
  await locked(() => { const w = load(); score(w); w.agents[opt("agent")].alive = false; w.agents[opt("agent")].retiredAt = Date.now(); save(w); });
} else {
  console.error("commands: outline | todo | apply | lint | score | register | retire");
  process.exit(1);
}
