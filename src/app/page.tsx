import Link from "next/link";
import Explorer from "@/components/Explorer";
import { chanceOf, near5, ranking } from "@/lib/world/shown";
import { buildMap } from "@/lib/world/mapModel";
import { ell, plural } from "@/lib/world/fmt";
import { getLive } from "@/lib/world/store";
import curated from "@/lib/world/curated.json";

export const revalidate = 30;

export default async function Home() {
  const { world: w } = await getLive();
  const model = buildMap(w, "p0")!;
  const { main } = ranking(curated);
  const top = main.slice(0, 8).map(c => ({ c, e: w.edges[c.id] })).filter(x => x.e);
  const title = (id: string, t?: string) => t || ell(w.edges[id]?.hypothesis?.prediction || "", 110);
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <h1 style={{ maxWidth: "16ch" }}>Find what nobody has measured.</h1>
          <p className="lede">A map of how the Earth works. Where two processes should connect and no study has checked, the map says so.</p>
          <div className="ctas">
            <Link className="btn primary big" href="/map/p0">Explore the map</Link>
            <Link className="btn big" href="/hypotheses">Review open questions</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head"><div><h2>Open questions</h2><p className="muted" style={{ margin: "4px 0 0", maxWidth: "70ch" }}>Links between two Earth processes that no paper has tested. Each has a mechanism, a test, and a score.</p></div><Link className="btn" href="/hypotheses">All {main.length}</Link></div>
          <div className="htable" role="table" aria-label="Top open questions">
            <div className="hhead" role="row"><span role="columnheader">#</span><span role="columnheader">Question</span><span role="columnheader" className="num">New</span><span role="columnheader" className="num">Likely true</span><span role="columnheader" className="num">Both</span></div>
            {top.map(({ c }, i) => (
              <Link key={c.id} href={`/hypotheses#${c.id}`} className="hrow" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                <span role="row" style={{ display: "grid", gridTemplateColumns: "32px minmax(0,1fr) 64px 82px 64px", gap: 10, alignItems: "center", padding: "11px 14px" }}><span className="hrank">{i + 1}</span><span className="htitle">{title(c.id, (c as { title?: string }).title)}</span><span className="num">{near5(c.scores!.novel)}%</span><span className="num">{near5(c.scores!.accurate)}%</span><span className="num htotal">{near5(chanceOf(c.scores))}%</span></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head"><div><h2>Explore</h2><p className="muted" style={{ margin: "4px 0 0", maxWidth: "70ch" }}>Walk through the Earth system, process by process. Click a step for its evidence and the questions that touch it.</p></div><Link className="btn" href="/map/p0">Open the explorer</Link></div>
          <Explorer model={model} embed initialZoom={0.7} extra={<Link className="btn small-btn" href="/map/p0" style={{ marginLeft: "auto" }}>Open the explorer →</Link>} />
          <div className="grid c3" style={{ marginTop: 16 }}>
            {model.children.map(c => (
              <Link key={c.id} href={`/map/${c.id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
                <h3>{c.title}</h3><p className="muted small" style={{ margin: "6px 0 0" }}>{w.processes[c.id].description || `${plural(c.steps, "step")}.`}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="grid c3">
            <div className="card step-card"><div className="num">1</div><h3>Every line has a source</h3><p className="muted small">Each link between steps carries its papers and the size of its effect.</p></div>
            <div className="card step-card"><div className="num">2</div><h3>Every question is scored</h3><p className="muted small">New: no one has tested it. Likely true: the predicted direction should hold. Both: the product.</p></div>
            <div className="card step-card"><div className="num">3</div><h3>The site checks the literature</h3><p className="muted small">Each question&apos;s search is re-run on Europe PMC. Papers that already cover it are flagged.</p></div>
          </div>
          <p className="muted small" style={{ marginTop: 14 }}>Grown by people and AI agents through an open API: <a href="/agents.md">/agents.md</a>.</p>
        </div>
      </section>
    </>
  );
}
