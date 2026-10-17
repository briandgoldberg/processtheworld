import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import Link from "next/link";
import Linked from "@/components/Linked";
import { analysis, type WeakEdge } from "@/lib/world/analysis";
import { ell } from "@/lib/world/fmt";
import { getLive } from "@/lib/world/store";

export const metadata: Metadata = { title: "Gaps: the weakest and most important holes in the map", description: "The lines that carry the most of Earth's systems on the least evidence, the links that are probably missing, and the lines that contradict each other, ranked by how much depends on them." };
export const revalidate = 60;

const pct = (x: number) => `${Math.round(x * 100)}%`;
const StepLink = ({ s }: { s: { id: string; label: string; process: string; processTitle: string } }) => (
  <><Link href={`/map/${s.process}#${s.id}`}>{ell(s.label, 110)}</Link> <span className="small muted">({s.processTitle})</span></>
);
const Sources = ({ e }: { e: WeakEdge }) => (
  <details><summary className="small muted">{e.sources.length} source{e.sources.length === 1 ? "" : "s"} · {e.reasons.join(", ")}</summary>
    <ul className="ev">{e.sources.map((s, i) => <li key={i}><Linked text={s} /></li>)}</ul></details>
);

export default async function Gaps() {
  await requireAdmin();
  const { world: w } = await getLive();
  const a = analysis(w);
  return (
    <div className="wrap narrow" style={{ paddingTop: 24 }}>
      <h1 style={{ fontSize: "clamp(28px,4.5vw,44px)" }}>Gaps</h1>
      <p className="muted">Where the map is weakest where it matters most. <b>Downstream</b> is how many steps follow a line. <b>Confidence</b> comes from the cited confidence, links, votes and whether the line is quantified.</p>

      <h2 style={{ margin: "26px 0 8px" }}>Weakest links</h2>
      <p className="small muted">Lines carrying the most of the map on the least evidence. The best place to add a paper, a number, or a challenge.</p>
      <div className="tablewrap"><table className="t">
        <thead><tr><th>#</th><th>Line</th><th className="num">Downstream</th><th className="num">Confidence</th><th>Impact</th></tr></thead>
        <tbody>{a.weak.map((e, i) => (
          <tr key={e.id} id={e.id}>
            <td className="num">{i + 1}</td>
            <td><StepLink s={e.from} /> <span className="muted">→</span> <StepLink s={e.to} /><div className="small muted">{e.impact.note}</div><Sources e={e} /></td>
            <td className="num">{e.downstream}</td>
            <td className="num">{pct(e.conf)}</td>
            <td>{e.impact.direction}{e.impact.size}/5{e.impact.elasticity != null ? <div className="small muted">elasticity {e.impact.elasticity}</div> : <div className="small muted">not quantified</div>}</td>
          </tr>
        ))}</tbody>
      </table></div>

      <h2 style={{ margin: "30px 0 8px" }}>Missing links</h2>
      <p className="small muted">A step in one process makes a resource that a step in another process uses, and nothing on the map connects them. Each is a candidate for a hypothesis; check the literature first.</p>
      <div className="tablewrap"><table className="t">
        <thead><tr><th>#</th><th>Resource</th><th>Made by</th><th>Used by</th><th className="num">Downstream</th><th></th></tr></thead>
        <tbody>{a.missing.map((m, i) => (
          <tr key={m.from.id + m.to.id}>
            <td className="num">{i + 1}</td>
            <td><Link href={`/e/resource/${encodeURIComponent(m.resource)}`}>{m.resource}</Link></td>
            <td><StepLink s={m.from} /><div className="small muted">{m.from.id}</div></td>
            <td><StepLink s={m.to} /><div className="small muted">{m.to.id}</div></td>
            <td className="num">{m.downstream}</td>
            <td>{m.hypothesis ? <Link className="small" href={`/hypotheses#${m.hypothesis}`}>open question raised</Link> : <Link className="small" href={`/admin/paths?from=${m.from.id}&to=${m.to.id}`}>any path?</Link>}</td>
          </tr>
        ))}</tbody>
      </table></div>

      <h2 style={{ margin: "30px 0 8px" }}>Contradictions</h2>
      <p className="small muted">Two lines about the same mechanism that disagree in sign, size or range. At least one of them is wrong; a vote or a change request with the paper settles it.</p>
      {a.conflicts.length === 0 ? <p className="muted">None found right now.</p> : (
        <div className="grid">{a.conflicts.map(c => (
          <div className="card" key={c.a.id + c.b.id}>
            <span className={"pill " + (c.kind === "sign" ? "warn" : "sys")}>{c.kind === "sign" ? "Opposite sign" : c.kind === "range" ? "Ranges do not overlap" : "Very different size"}</span>
            <p style={{ margin: "8px 0 4px" }}>{c.note}.</p>
            <p className="small" style={{ margin: "4px 0" }}><b>{c.a.impact.direction}{c.a.impact.size}</b> <StepLink s={c.a.from} /> → <StepLink s={c.a.to} /> <span className="muted">by {c.a.by}, confidence {pct(c.a.conf)}</span></p>
            <p className="small" style={{ margin: "4px 0" }}><b>{c.b.impact.direction}{c.b.impact.size}</b> <StepLink s={c.b.from} /> → <StepLink s={c.b.to} /> <span className="muted">by {c.b.by}, confidence {pct(c.b.conf)}</span></p>
          </div>
        ))}</div>
      )}

      <p className="muted small" style={{ marginTop: 30 }}>API: <code>/api/world/read/gaps</code>. Submissions: <a href="/agents.md">/agents.md</a>.</p>
    </div>
  );
}
