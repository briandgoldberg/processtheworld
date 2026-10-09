// Turns a process (the app's JSON document) into one Markdown file that
// ChatGPT, Claude or any other model can read in full: a plain-language
// description, a flow diagram, and the complete data underneath.

type Lane = { id: string; name: string; type: "person" | "system" | string };
type Next = { to: string; label?: string; map?: string };
type Step = { id: string; lane: string; label: string; kind?: string; uses?: string[]; next?: Next[]; child?: string; link?: { id: string; title?: string; scope?: string } };
export type MapT = { id: string; title?: string; parent?: { map: string; step: string } | null; lanes: Lane[]; steps: Step[] };
type Doc = { title?: string; maps: Record<string, MapT> };

const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Steps in the order the process runs: starts first, then follow the arrows, then anything left over. */
export function ordered(m: MapT): Step[] {
  const byId = new Map(m.steps.map(s => [s.id, s]));
  const seen = new Set<string>(), out: Step[] = [];
  const visit = (id: string) => {
    const s = byId.get(id);
    if (!s || seen.has(id)) return;
    seen.add(id); out.push(s);
    for (const n of s.next || []) if (!n.map) visit(n.to);
  };
  m.steps.filter(s => s.kind === "start").forEach(s => visit(s.id));
  m.steps.forEach(s => visit(s.id));
  return out;
}

function mermaid(m: MapT): string {
  const lanes = new Map(m.lanes.map(l => [l.id, l]));
  const node = (s: Step) => {
    const t = clean(s.label).replace(/"/g, "'");
    const n = "n_" + s.id; // ids like "end" and "start" are reserved words in Mermaid
    return s.kind === "decision" ? `${n}{"${t}"}` : s.kind === "start" || s.kind === "end" ? `${n}(["${t}"])` : s.kind === "subprocess" ? `${n}[["${t}"]]` : `${n}["${t}"]`;
  };
  const lines = ["flowchart LR"];
  for (const l of m.lanes) {
    const inLane = m.steps.filter(s => s.lane === l.id);
    if (!inLane.length) continue;
    lines.push(`  subgraph l_${l.id}["${clean(l.name).replace(/"/g, "'")}"]`);
    inLane.forEach(s => lines.push(`    ${node(s)}`));
    lines.push("  end");
  }
  m.steps.filter(s => !lanes.has(s.lane)).forEach(s => lines.push(`  ${node(s)}`));
  for (const s of m.steps) for (const n of s.next || []) if (!n.map) lines.push(`  n_${s.id} ${n.label ? `-->|"${clean(n.label).replace(/"/g, "'")}"|` : "-->"} n_${n.to}`);
  return lines.join("\n");
}

function section(m: MapT, doc: Doc, level: string): string {
  const lanes = new Map(m.lanes.map(l => [l.id, l]));
  const laneName = (id: string) => clean(lanes.get(id)?.name) || id;
  const lines: string[] = [];
  const parent = m.parent ? doc.maps[m.parent.map]?.steps.find(s => s.id === m.parent!.step) : null;
  lines.push(`${level} ${clean(m.title) || m.id}${parent ? ` (detail of step "${clean(parent.label)}")` : ""}`, "");
  if (m.lanes.length) {
    lines.push("Lanes:");
    m.lanes.forEach(l => lines.push(`- ${clean(l.name)}: ${l.type === "system" ? "technology / system" : "person / role"} (id \`${l.id}\`)`));
    lines.push("");
  }
  lines.push("Steps, in the order they run:", "");
  ordered(m).forEach((s, i) => {
    const uses = (s.uses || []).map(laneName).filter(Boolean);
    const next = (s.next || []).map(n => {
      const target = n.map ? `${doc.maps[n.map]?.steps.find(x => x.id === n.to)?.label ?? n.to} (in layer "${clean(doc.maps[n.map]?.title) || n.map}")` : clean(m.steps.find(x => x.id === n.to)?.label) || n.to;
      return n.label ? `if "${clean(n.label)}" go to ${target}` : `then ${target}`;
    });
    lines.push(`${i + 1}. **${clean(s.label)}** [${s.kind || "task"}; ${laneName(s.lane)}; id \`${s.id}\`]${uses.length ? `, using ${uses.join(", ")}` : ""}${s.child && doc.maps[s.child] ? `, opens the detail layer "${clean(doc.maps[s.child].title) || s.child}"` : ""}${s.link ? (s.link.scope === "private" ? `, links to the saved process "${clean(s.link.title) || s.link.id}" (not public; open it in Process the World)` : `, links to the published process "${clean(s.link.title) || s.link.id}" (https://processtheworld.vercel.app/p/${s.link.id}; full text at https://processtheworld.vercel.app/api/public/${s.link.id}/export)`) : ""}`);
    if (next.length) lines.push(`   - ${next.join("; ")}`);
    else if (s.kind !== "end") lines.push("   - (no next step recorded)");
  });
  lines.push("", "```mermaid", mermaid(m), "```", "");
  return lines.join("\n");
}

export function exportMarkdown(doc: Doc, opts: { url?: string; author?: string } = {}): string {
  const maps = doc.maps || {};
  const root = maps.m_root || Object.values(maps)[0];
  const title = clean(doc.title || root?.title) || "Untitled process";
  const all = Object.values(maps);
  const steps = all.reduce((n, m) => n + m.steps.length, 0);
  const out: string[] = [];
  out.push(`# ${title}`, "");
  out.push(`> A process map exported from Process the World (https://processtheworld.vercel.app).${opts.author ? ` Author: ${opts.author}.` : ""}${opts.url ? ` Source: ${opts.url}` : ""}`);
  out.push("> It describes who does what, in what order, and with which technology. Read the plain-language sections first; the JSON at the end is the exact, complete data.", "");
  out.push("## Summary", "");
  out.push(`- ${steps} steps across ${all.length} layer${all.length === 1 ? "" : "s"}`);
  const people = (root?.lanes || []).filter(l => l.type !== "system").map(l => clean(l.name));
  const tech = (root?.lanes || []).filter(l => l.type === "system").map(l => clean(l.name));
  if (people.length) out.push(`- People / roles: ${people.join(", ")}`);
  if (tech.length) out.push(`- Technology / systems: ${tech.join(", ")}`);
  out.push("", "## How to read this file", "");
  out.push("- A process is made of **layers**. The main layer is the top level; any step of kind `subprocess` opens a detail layer with its own lanes and steps.");
  out.push("- **Lanes** are either people/roles or technology/systems. Each step belongs to one lane; `using` lists tools a person uses for that step.");
  out.push("- Step kinds: `start`, `task`, `decision` (its arrows carry the answer as a label), `subprocess`, `end`.", "");
  if (root) out.push(section(root, { maps }, "##"));
  all.filter(m => m !== root).forEach(m => out.push(section(m, { maps }, "###")));
  out.push("## Full data (JSON)", "", "```json", JSON.stringify({ title, maps }, null, 2), "```", "");
  return out.join("\n");
}
