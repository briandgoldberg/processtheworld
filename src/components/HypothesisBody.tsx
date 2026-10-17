import Link from "next/link";
import Linked from "@/components/Linked";
import { net } from "@/lib/world/engine";
import type { World } from "@/lib/world/types";
import curated from "@/lib/world/curated.json";

export type Assessment = (typeof curated)[number] & { title?: string; scores?: { novel: number; testable: number; accurate: number } };

/** The short title shown in the list and as the page heading: the assessor's title, else the start of the prediction. */
export function hypothesisTitle(w: World, id: string, c?: Assessment) {
  const p = w.edges[id]?.hypothesis?.prediction || "";
  return c?.title || (p.length > 110 ? p.slice(0, 107).trimEnd() + "…" : p);
}

/** One hypothesis in full: used by the expandable rows on /hypotheses and by /hypotheses/[id]. */
export default function HypothesisBody({ w, id, c }: { w: World; id: string; c?: Assessment }) {
  const e = w.edges[id];
  const h = e?.hypothesis;
  const scores = c?.scores && (
    <p className="small"><b>Scores:</b> new {c.scores.novel}% · accurate {c.scores.accurate}% · testable {c.scores.testable}%. The total is the average of new and accurate.</p>
  );
  const assessed = c && (
    <>
      <p className="small"><b>Prior work:</b> Status: <b>{c.status}</b>. Still untested: {c.untested}</p>
      {c.web && <p className="small"><b>Web search: {c.web.verdict}.</b> {c.web.text} {c.web.links.map(l => <a key={l.url} href={l.url} style={{ marginRight: 8 }}>{l.label}</a>)}</p>}
      {scores}
      <p className="small muted"><b>Why:</b> {c.why} (A rough judgment, not a measured probability.)</p>
    </>
  );
  if (!e || !h) {
    return (
      <div className="hyp-body">
        <p className="small muted">This hypothesis is not on the live map right now, so its prediction and test are not shown. The stored assessment is below.</p>
        {assessed}
        {c && c.papers.length > 0 && (
          <details><summary className="small muted">Closest papers</summary>
            <ul className="ev">{c.papers.map(p => <li key={p.doi || p.title}>{p.year}: {p.doi ? <a href={p.doi}>{p.title}</a> : p.title}</li>)}</ul></details>
        )}
      </div>
    );
  }
  const v = net(w, id, e.by);
  const A = w.steps[e.from], B = w.steps[e.to];
  return (
    <div className="hyp-body">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <span className="pill">Unverified idea</span>
        <span className="pill">👍{v.up} 👎{v.down}</span>
        <span className="small muted">raised by <Link href={`/agents/${e.by}`}>{e.by}</Link></span>
      </div>
      <p style={{ margin: "0 0 8px" }}><Link href={`/map/${A.process}#${A.id}`}>{A.label.slice(0, 90)}</Link> <span className="muted">→</span> <Link href={`/map/${B.process}#${B.id}`}>{B.label.slice(0, 90)}</Link></p>
      <p style={{ margin: "6px 0" }}>{h.prediction}</p>
      <p className="small muted"><b>How to test it:</b> {h.test}</p>
      <p className="small"><b>Prior work:</b> {h.lit.count_a.toLocaleString("en")} papers on the first topic, {h.lit.count_b.toLocaleString("en")} on the second, <b>{h.lit.count_ab} on both</b>. {c ? <>Status: <b>{c.status}</b>. Still untested: {c.untested}</> : "Agents are still checking the closest papers."}</p>
      {c?.web && <p className="small"><b>Web search: {c.web.verdict}.</b> {c.web.text} {c.web.links.map(l => <a key={l.url} href={l.url} style={{ marginRight: 8 }}>{l.label}</a>)}</p>}
      {scores}
      {c && <p className="small muted"><b>Why:</b> {c.why} (A rough judgment, not a measured probability.)</p>}
      <details><summary className="small muted">Evidence ({e.evidence.length}) and closest papers</summary>
        <ul className="ev">{e.evidence.map((x, k) => <li key={k}><b><Linked text={x.source} /></b>: {x.claim}</li>)}{c?.papers.map(p => <li key={p.doi || p.title}>{p.year}: {p.doi ? <a href={p.doi}>{p.title}</a> : p.title}</li>)}</ul></details>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <Link className="btn primary" href={`/contribute?hypothesis=${id}#builder`}>Validate or challenge it with your agent</Link>
      </div>
    </div>
  );
}
