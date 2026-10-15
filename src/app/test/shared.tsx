import world from "@/lib/test/world.json";

export type Ev = { source: string; claim: string; confidence: number | null };
export type Step = { id: string; process: string; label: string; kind: string; participants: string[]; resources: string[]; evidence: Ev[]; by: string; status: string; sub?: string };
export type Edge = { id: string; from: string; to: string; label: string; prob?: number; impact: { size: number; direction: string; note: string }; loop?: { kind: string; strength: string; gain: number }; evidence: Ev[]; by: string; status: string; cross?: boolean; hypothesis?: { prediction: string; test: string; lit: { query_a?: string; query_b?: string; count_a: number; count_b: number; count_ab: number } } };
export type Proc = { id: string; title: string; description?: string; boundary?: { start?: string; end?: string }; parentStep: string | null; start: string; ends: string[]; by: string };
export type Proposal = { id: string; target: string; set?: Record<string, unknown>; delete: boolean; reason: string; by: string; status: string };
export type Vote = { agent: string; target: string; vote: "up" | "down"; reason: string };
export type Agent = { name: string; gen: number; parent: string | null; prompt: string; alive: boolean; points: number };

export const W = world as unknown as { meta: { title: string }; processes: Record<string, Proc>; steps: Record<string, Step>; edges: Record<string, Edge>; proposals: Record<string, Proposal>; votes: Vote[]; agents: Record<string, Agent> };
export const steps = Object.values(W.steps).filter(s => s.status !== "removed");
export const edges = Object.values(W.edges).filter(e => e.status !== "removed");
export const tally = (id: string) => { const v = W.votes.filter(x => x.target === id); return { up: v.filter(x => x.vote === "up").length, down: v.filter(x => x.vote === "down").length }; };
export const Votes = ({ id }: { id: string }) => { const t = tally(id); return <span className="hint"> · 👍{t.up} 👎{t.down}</span>; };
export const Evidence = ({ ev }: { ev: Ev[] }) => (
  <details><summary className="hint">evidence ({ev.length})</summary>
    <ul>{ev.map((e, i) => <li key={i}><b>{e.source}</b>: {e.claim}{e.confidence != null ? ` (confidence ${e.confidence})` : ""}</li>)}</ul>
  </details>
);

// Linktrees: every participant / resource name, with every place it is used.
export function trees(key: "participants" | "resources") {
  const m = new Map<string, { name: string; uses: Step[] }>();
  for (const s of steps) for (const n of s[key]) {
    const k = n.trim().toLowerCase();
    const e = m.get(k) || { name: n, uses: [] };
    e.uses.push(s); m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.uses.length - a.uses.length || a.name.localeCompare(b.name));
}
export const Linktrees = ({ title, data }: { title: string; data: ReturnType<typeof trees> }) => (
  <section>
    <h3>{title} ({data.length})</h3>
    {data.length ? data.map(t => {
      const procs = [...new Set(t.uses.map(s => s.process))];
      return (
        <details key={t.name}>
          <summary>{t.name} <span className="hint">in {procs.length} process{procs.length === 1 ? "" : "es"}, {t.uses.length} step{t.uses.length === 1 ? "" : "s"}</span></summary>
          <ul>{procs.map(p => (
            <li key={p}><a href={`#proc-${p}`}>{W.processes[p]?.title}</a>
              <ul>{t.uses.filter(s => s.process === p).map(s => <li key={s.id}><a href={`#step-${s.id}`}>{s.label}</a></li>)}</ul>
            </li>
          ))}</ul>
        </details>
      );
    }) : <p className="hint">None yet.</p>}
  </section>
);

export function Process({ id, depth }: { id: string; depth: number }) {
  const p = W.processes[id];
  const mine = steps.filter(s => s.process === id);
  return (
    <div id={`proc-${id}`} style={{ marginLeft: depth ? 16 : 0, borderLeft: depth ? "2px solid #8884" : undefined, paddingLeft: depth ? 10 : 0 }}>
      <h4>{p.title} <span className="hint">({id}, layer {depth + 1})</span></h4>
      {p.description && <p>{p.description}</p>}
      {p.boundary && <p className="hint">Boundary. Starts: {p.boundary.start} Ends: {p.boundary.end}</p>}
      {mine.map(s => {
        const out = edges.filter(e => e.from === s.id);
        return (
          <div key={s.id} id={`step-${s.id}`} style={{ margin: "8px 0" }}>
            <b>{s.kind === "fork" ? "⑂ " : s.kind === "subprocess" ? "▸ " : s.kind === "start" ? "● " : s.kind === "end" ? "■ " : ""}{s.label}</b>
            <span className="hint"> · {s.kind} · by {s.by}</span><Votes id={s.id} />
            <div className="hint">Participants: {s.participants.join(", ") || "-"} · Resources: {s.resources.join(", ") || "-"}</div>
            {s.by !== "seed" && <Evidence ev={s.evidence} />}
            {out.length > 0 && (
              <ul>{out.map(e => (
                <li key={e.id} id={`edge-${e.id}`}>
                  {e.prob != null && <b>{e.prob}% </b>}{e.label && `${e.label} `}→ <a href={`#step-${e.to}`}>{W.steps[e.to]?.label}</a>
                  <span className="hint"> · impact {e.impact.direction}{e.impact.size}/5: {e.impact.note}{e.cross ? " · crosses processes" : ""}</span>
                  {e.loop && <b> ↻ {e.loop.kind} loop, {e.loop.strength}, gain {e.loop.gain}</b>}
                  <Votes id={e.id} />
                  <Evidence ev={e.evidence} />
                </li>
              ))}</ul>
            )}
            {s.sub && <Process id={s.sub} depth={depth + 1} />}
          </div>
        );
      })}
    </div>
  );
}
