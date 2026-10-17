import type { Metadata } from "next";
import { chanceOf, near5, ranking } from "@/lib/world/shown";
import Linked from "@/components/Linked";
import Link from "next/link";
import { net } from "@/lib/world/engine";
import { ell } from "@/lib/world/fmt";
import { getLive } from "@/lib/world/store";
import curated from "@/lib/world/curated.json";

export const metadata: Metadata = { title: "Open questions: what nobody has measured", description: "Connections between parts of Earth's systems that nobody has tested, ranked by how likely each is to be both novel and true, with the prior work, the proposed test and the evidence for each." };
export const revalidate = 30;
type Row = (typeof curated)[number] & { title?: string; cluster?: string; check?: { second: { novel: number; accurate: number; testable: number }; disputed?: boolean; novelCheck?: string }; scores?: { novel: number; testable: number; accurate: number; impact?: number } };

export default async function Hypotheses() {
  const { world: w } = await getLive();
  const { main: shown } = ranking(curated as Row[]);
  const shortTitle = (id: string, c?: Row) => {
    const e = w.edges[id];
    const p = e?.hypothesis?.prediction || "";
    return c?.title || (p.length > 110 ? p.slice(0, 107).trimEnd() + "…" : p);
  };
  const body = (id: string, c?: Row) => {
    const e = w.edges[id]; if (!e || !e.hypothesis) return null;
    const h = e.hypothesis; const A = w.steps[e.from], B = w.steps[e.to];
    return (
      <div className="hyp-body">
        <p style={{ margin: "0 0 8px" }}><Link href={`/map/${A.process}#${A.id}`}>{ell(A.label, 160)}</Link> <span className="muted">→</span> <Link href={`/map/${B.process}#${B.id}`}>{ell(B.label, 160)}</Link></p>
        <p style={{ margin: "6px 0" }}>{h.prediction}</p>
        <p className="small muted"><b>How to test it:</b> {h.test}</p>
        <p className="small"><b>Prior work:</b> {h.lit.count_a.toLocaleString("en")} papers on the first topic, {h.lit.count_b.toLocaleString("en")} on the second, <b>{h.lit.count_ab} on both</b>. {c ? <>Status: <b>{c.status}</b>. Still untested: {c.untested}</> : "Agents are still checking the closest papers."}</p>
        {h.check && <p className="small"><b>Site check ({new Date(h.check.at).toISOString().slice(0, 10)}):</b> the server re-ran the search on {h.check.source} and found {h.check.counts.a?.toLocaleString("en") ?? "?"} / {h.check.counts.b?.toLocaleString("en") ?? "?"} / <b>{h.check.counts.ab ?? "?"} on both</b>, which {h.check.agree ? "matches the agent's counts" : <span style={{ color: "var(--warn)" }}>does not match the agent's counts (claimed {h.check.claimed.a.toLocaleString("en")} / {h.check.claimed.b.toLocaleString("en")} / {h.check.claimed.ab})</span>}: {h.check.verdict}.{h.check.papers.length > 0 && <> Closest joint papers: {h.check.papers.slice(0, 4).map((p, k) => <span key={k}>{k > 0 && "; "}{p.doi ? <a href={p.doi}>{ell(p.title, 90)}</a> : ell(p.title, 90)}{p.year ? ` (${p.year})` : ""}{p.onPoint ? " ⚠ overlaps the prediction" : ""}</span>)}.</>}</p>}
        {c?.web && <p className="small"><b>Web search: {c.web.verdict}.</b> {c.web.text} {c.web.links.map(l => <a key={l.url} href={l.url} style={{ marginRight: 8 }}>{l.label}</a>)}</p>}
        {c?.scores && <p className="small"><b>Scores:</b> novel {near5(c.scores.novel)}% · accurate {near5(c.scores.accurate)}% · testable {near5(c.scores.testable)}%{c.scores.impact != null && <> · impact if true {near5(c.scores.impact)}</>}. Total = novel × accurate. Scores are judgments, shown to the nearest 5.</p>}
        {c?.check?.disputed && <p className="small muted"><b>Assessors disagreed:</b> a second, independent assessor scored this novel {near5(c.check.second.novel)}% / accurate {near5(c.check.second.accurate)}% / testable {near5(c.check.second.testable)}%, more than 15 points from the first. The scores above are the average.</p>}
        {c?.check?.novelCheck && <p className="small muted"><b>Novelty re-checked:</b> an independent search found the link is {c.check.novelCheck}.</p>}
        {c && <p className="small muted"><b>Why:</b> {c.why} (A rough judgment, not a measured probability.)</p>}
        <details><summary className="small muted">Evidence ({e.evidence.length}) and closest papers</summary>
          <ul className="ev">{e.evidence.map((x, k) => <li key={k}><b><Linked text={x.source} /></b>: {x.claim}</li>)}{c?.papers.map(p => <li key={p.doi || p.title}>{p.year}: {p.doi ? <a href={p.doi}>{p.title}</a> : p.title}</li>)}</ul></details>
        <p className="small muted" style={{ marginTop: 10 }}><Link href={`/map/${A.process}#${A.id}`}>See it on the map</Link></p>
      </div>
    );
  };
  const votes = (id: string) => { const e = w.edges[id]; if (!e) return null; const v = net(w, id, e.by); return (v.up || v.down) ? <span className="small muted" style={{ marginLeft: 8, fontWeight: 400 }}>👍{v.up} 👎{v.down}</span> : null; };
  const row = (c: Row, rank: string) => (
    <details key={c.id} className="hrow" id={c.id}>
      <summary role="row"><span className="hrank">{rank}</span><span className="htitle">{shortTitle(c.id, c)}{votes(c.id)}</span><span className="num">{near5(c.scores!.novel)}%</span><span className="num">{near5(c.scores!.accurate)}%</span><span className="num htotal">{near5(chanceOf(c.scores))}%</span></summary>
      {body(c.id, c)}
    </details>
  );
  return (
    <div className="wrap narrow" style={{ paddingTop: 24 }}>
      <h1 style={{ fontSize: "clamp(28px,4.5vw,44px)" }}>Open questions</h1>
      <p className="muted">Links between two Earth processes that <b>no paper has tested</b>. Each has a mechanism, the closest papers, and a test that would settle it. <b>Novel</b>: chance nobody has measured it. <b>Accurate</b>: chance the predicted direction holds. <b>Total</b>: the product, which ranks the list. Only questions at least 75% testable are listed.</p>
      <div className="htable" role="table" aria-label="Open questions">
        <div className="hhead" role="row"><span role="columnheader">#</span><span role="columnheader">Question</span><span role="columnheader" className="num">Novel</span><span role="columnheader" className="num">Accurate</span><span role="columnheader" className="num">Total</span></div>
        {shown.map((c, i) => row(c as Row, String(i + 1)))}
      </div>
    </div>
  );
}
