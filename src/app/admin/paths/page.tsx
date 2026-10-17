import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import Link from "next/link";
import Linked from "@/components/Linked";
import { paths } from "@/lib/world/analysis";
import { ell } from "@/lib/world/fmt";
import { getLive } from "@/lib/world/store";

export const metadata: Metadata = { title: "Paths: how one step reaches another, and the weakest link on the way", description: "Pick two steps on the map of Earth's systems and see every chain of lines between them, the line with the least evidence on each chain, and the composed effect where the lines are quantified." };
export const dynamic = "force-dynamic";

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default async function Paths({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireAdmin();
  const { from = "", to = "" } = await searchParams;
  const { world: w } = await getLive();
  const steps = Object.values(w.steps).filter(s => s.status === "live" && s.kind !== "start" && s.kind !== "end");
  const label = (id: string) => w.steps[id]?.label || id;
  const resolve = (q: string) => { const t = q.trim(); if (!t) return ""; if (w.steps[t]) return t; const m = t.match(/\((s[\w]+)\)\s*$/); if (m && w.steps[m[1]]) return m[1]; const hit = steps.find(s => s.label.toLowerCase() === t.toLowerCase()) || steps.find(s => s.label.toLowerCase().includes(t.toLowerCase())); return hit?.id || ""; };
  const a = resolve(from), b = resolve(to);
  const found = a && b ? paths(w, a, b) : [];
  return (
    <div className="wrap narrow" style={{ paddingTop: 24 }}>
      <h1 style={{ fontSize: "clamp(28px,4.5vw,44px)" }}>Paths</h1>
      <p className="muted">Pick a start and an end. Every chain of lines between them is listed, shortest first, with the <b>weakest link</b> (the line with the least evidence) marked and its sources one click away. Where every line on a chain is quantified, the elasticities multiply into an overall estimate: the % change at the end per 1% change at the start.</p>
      <form action="/admin/paths" className="card" style={{ display: "grid", gap: 10, margin: "14px 0 22px" }}>
        <label className="small muted" htmlFor="from">From (type part of a step&apos;s name, or its id)</label>
        <input id="from" name="from" list="steps" defaultValue={a ? `${label(a)} (${a})` : from} placeholder="e.g. Nitrifiers oxidize ammonium" style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 10, padding: "10px 12px" }} />
        <label className="small muted" htmlFor="to">To</label>
        <input id="to" name="to" list="steps" defaultValue={b ? `${label(b)} (${b})` : to} placeholder="e.g. Nitrous oxide persists about 109 years" style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 10, padding: "10px 12px" }} />
        <datalist id="steps">{steps.map(s => <option key={s.id} value={`${ell(s.label, 100)} (${s.id})`} />)}</datalist>
        <div><button className="btn primary" type="submit">Find paths</button></div>
      </form>
      {(from || to) && (!a || !b) && <p className="muted">Could not match {!a ? `“${from}”` : `“${to}”`} to a step. Pick one from the list that appears as you type.</p>}
      {a && b && found.length === 0 && <p className="muted">No forward path from <b>{label(a)}</b> to <b>{label(b)}</b> within 10 lines. Try the other direction, or this is a gap worth a hypothesis.</p>}
      {found.length > 0 && <p className="small muted">{found.length} path{found.length === 1 ? "" : "s"} from <b>{label(a)}</b> to <b>{label(b)}</b>{found.length >= 30 ? " (showing the 30 shortest)" : ""}.</p>}
      <div className="grid">{found.map((p, i) => (
        <div className="card" key={i}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span className="pill">{p.lines} line{p.lines === 1 ? "" : "s"}</span>
            <span className="pill">overall sign {p.sign}</span>
            {p.elasticity ? <span className="pill ok">composed elasticity {p.elasticity.value} (range {p.elasticity.low} to {p.elasticity.high})</span> : <span className="pill">{p.quantified} of {p.lines} lines quantified</span>}
          </div>
          <ol style={{ margin: "10px 0 0", paddingLeft: 20 }}>{p.hops.map((h, k) => (
            <li key={k} style={{ margin: "6px 0" }}>
              {h.edge && <div className={"small" + (p.weakest === k ? "" : " muted")} style={p.weakest === k ? { color: "var(--warn)", fontWeight: 600 } : undefined}>
                {p.weakest === k ? "weakest link · " : ""}impact {h.edge.impact.direction}{h.edge.impact.size}/5{h.edge.impact.elasticity != null ? `, elasticity ${h.edge.impact.elasticity}` : ""}, confidence {pct(h.edge.conf)} ({h.edge.reasons.join(", ")}){h.edge.loop ? ", loop" : ""}
                <details><summary className="small muted">sources ({h.edge.sources.length})</summary><ul className="ev">{h.edge.sources.map((s, j) => <li key={j}><Linked text={s} /></li>)}</ul></details>
              </div>}
              {!h.edge && k > 0 && <div className="small muted">enters or leaves a subprocess</div>}
              <Link href={`/map/${h.step.process}#${h.step.id}`}>{ell(h.step.label, 120)}</Link> <span className="small muted">({h.step.processTitle})</span>
            </li>
          ))}</ol>
        </div>
      ))}</div>
    </div>
  );
}
