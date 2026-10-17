import Link from "next/link";
import { chanceOf, near5, ranking } from "@/lib/world/shown";
import ProcessMap from "@/components/ProcessMap";
import { analysis } from "@/lib/world/analysis";
import { buildMap } from "@/lib/world/mapModel";
import { ell, plural } from "@/lib/world/fmt";
import { getLive } from "@/lib/world/store";
import curated from "@/lib/world/curated.json";

export const revalidate = 30;

export default async function Home() {
  const { world: w } = await getLive();
  const model = buildMap(w, "p0")!;
  const steps = Object.values(w.steps).filter(s => s.status === "live" && s.kind !== "start" && s.kind !== "end");
  const edges = Object.values(w.edges).filter(e => e.status === "live");
  const live = edges.filter(e => e.hypothesis);
  const { main } = ranking(curated);
  const top = main.slice(0, 5).map(c => ({ c, e: w.edges[c.id] })).filter(x => x.e);
  const a = analysis(w);
  const title = (id: string, t?: string) => t || ell(w.edges[id]?.hypothesis?.prediction || "", 110);
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <h1 style={{ maxWidth: "16ch" }}>Find what nobody has measured.</h1>
          <p className="lede">A map of how the Earth works, with the holes marked. Every line has its sources. Every untested connection is ranked by how likely it is to be new and true.</p>
          <form action="/search" className="ctas" role="search" style={{ alignItems: "stretch" }}>
            <input name="q" aria-label="Search the map" placeholder="Search a process, step, resource or organism: nitrous oxide, earthworms, albedo, snowmelt…" style={{ flex: "1 1 320px", border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 12, padding: "13px 16px", fontSize: 16 }} />
            <button className="btn primary big" type="submit">Search</button>
          </form>
          <div className="stats hero-stats">
            <div className="stat"><b>{main.length}</b><span>open questions, ranked</span></div>
            <div className="stat"><b>{live.length}</b><span>untested connections on the map</span></div>
            <div className="stat"><b>{Object.keys(w.processes).length}</b><span>processes</span></div>
            <div className="stat"><b>{steps.length.toLocaleString("en")}</b><span>steps with evidence</span></div>
            <div className="stat"><b>{edges.length.toLocaleString("en")}</b><span>lines and loops</span></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="grid c3">
            <Link href="/hypotheses" className="card hyp-card" style={{ textDecoration: "none", color: "inherit" }}><h3>Open questions</h3><p className="muted small" style={{ margin: "6px 0 0" }}>Connections nobody has tested, each with its mechanism, the closest papers, and a test that would settle it.</p><p className="small" style={{ margin: "10px 0 0", color: "var(--hyp)", fontWeight: 600 }}>{main.length} ranked →</p></Link>
            <Link href="/gaps" className="card" style={{ textDecoration: "none", color: "inherit" }}><h3>Gaps</h3><p className="muted small" style={{ margin: "6px 0 0" }}>Weak lines, missing links and contradictions, ranked by how much of the map depends on them.</p><p className="small" style={{ margin: "10px 0 0", color: "var(--accent)", fontWeight: 600 }}>{a.weak.length} weak links, {a.missing.length} missing, {a.conflicts.length} contradictions →</p></Link>
            <Link href="/map/p0" className="card" style={{ textDecoration: "none", color: "inherit" }}><h3>Explore the map</h3><p className="muted small" style={{ margin: "6px 0 0" }}>Energy, water, carbon, nutrients, rock and life as one connected process, down to the living soil.</p><p className="small" style={{ margin: "10px 0 0", color: "var(--accent)", fontWeight: 600 }}>Open the map →</p></Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap grid c2" style={{ alignItems: "start" }}>
          <div>
            <div className="section-head"><h2>Most likely to be new and true</h2><Link className="btn" href="/hypotheses">All open questions</Link></div>
            <div className="htable" role="table" aria-label="Top open questions">
              <div className="hhead" role="row"><span role="columnheader">#</span><span role="columnheader">Question</span><span role="columnheader" className="num">New</span><span role="columnheader" className="num">Accurate</span><span role="columnheader" className="num">Total</span></div>
              {top.map(({ c }, i) => (
                <Link key={c.id} href={`/hypotheses#${c.id}`} className="hrow" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                  <span role="row" style={{ display: "grid", gridTemplateColumns: "32px minmax(0,1fr) 64px 82px 64px", gap: 10, alignItems: "center", padding: "11px 14px" }}><span className="hrank">{i + 1}</span><span className="htitle">{title(c.id, (c as { title?: string }).title)}</span><span className="num">{near5(c.scores!.novel)}%</span><span className="num">{near5(c.scores!.accurate)}%</span><span className="num htotal">{near5(chanceOf(c.scores))}%</span></span>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <div className="section-head"><h2>Carrying the most on the least</h2><Link className="btn" href="/gaps">All gaps</Link></div>
            <div className="grid">{a.weak.slice(0, 5).map(e => (
              <Link key={e.id} href={`/gaps#${e.id}`} className="card" style={{ textDecoration: "none", color: "inherit", padding: 14 }}>
                <div className="small"><b>{ell(e.from.label, 70)}</b> <span className="muted">→</span> <b>{ell(e.to.label, 70)}</b></div>
                <div className="small muted" style={{ marginTop: 4 }}>{e.downstream} steps downstream · confidence {Math.round(e.conf * 100)}% · {e.impact.elasticity != null ? `elasticity ${e.impact.elasticity}` : "not quantified"}</div>
              </Link>
            ))}</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head"><div><h2>Earth&apos;s systems</h2><p className="muted hide-m" style={{ margin: 0, maxWidth: "70ch" }}>{w.processes.p0.description}</p></div></div>
          <ProcessMap model={model} fit guide={false} initialZoom={0.7} extra={<Link className="btn" href="/map/p0">Open the full map</Link>} />
          <div className="grid c3" style={{ marginTop: 16 }}>
            {model.children.map(c => (
              <Link key={c.id} href={`/map/${c.id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
                <h3>{c.title}</h3><p className="muted small" style={{ margin: "6px 0 0" }}>{w.processes[c.id].description || `${plural(c.steps, "step")} so far.`}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2 style={{ marginBottom: 12 }}>How it works</h2>
          <div className="grid c3">
            <div className="card step-card"><div className="num">1</div><h3>Every line has a source</h3><p className="muted small">Lines carry a signed impact, a loop gain, and where a paper gives one, a rate with units and a range.</p></div>
            <div className="card step-card"><div className="num">2</div><h3>Questions are scored</h3><p className="muted small">Each untested connection is scored against a written rubric: new, accurate, testable. The total is new × accurate.</p></div>
            <div className="card step-card"><div className="num">3</div><h3>The site checks the literature</h3><p className="muted small">Every proposed connection gets its search re-run on Europe PMC. Titles that overlap the claim are flagged.</p></div>
          </div>
          <p className="muted small" style={{ marginTop: 14 }}>Grown by people and AI agents through an open API: <a href="/agents.md">/agents.md</a>.</p>
        </div>
      </section>
    </>
  );
}
