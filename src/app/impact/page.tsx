import type { Metadata } from "next";
import Link from "next/link";
import Linked from "@/components/Linked";
import { search } from "@/lib/world/engine";
import { impactOf, strengthWord } from "@/lib/world/impact";
import { ell } from "@/lib/world/fmt";
import { getLive } from "@/lib/world/store";

export const metadata: Metadata = { title: "Impact: what one step changes", description: "Pick any step on the map of Earth's systems and see everything downstream of it, strongest first, with the chain of cited lines that carries each effect." };
export const dynamic = "force-dynamic";

const SIGN: Record<string, string> = { "+": "raises", "-": "lowers", "0": "changes" };

// Impact tracing: from one step, everything it affects, strongest first, each with its chain and sources.
export default async function ImpactPage({ searchParams }: { searchParams: Promise<{ step?: string; q?: string }> }) {
  const { step = "", q = "" } = await searchParams;
  const { world: w, ents } = await getLive();
  const imp = step && w.steps[step] ? impactOf(w, step) : null;
  const hits = !imp && q.trim().length >= 2 ? search(w, ents, q, 15).steps : [];
  const inputStyle = { border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 12, padding: "12px 14px", fontSize: 16, flex: "1 1 640px", minWidth: 0 } as const;
  return (
    <div className="wrap" style={{ paddingTop: 24, maxWidth: 960 }}>
      <h1 style={{ fontSize: "clamp(28px,4.5vw,44px)" }}>Impact</h1>
      {imp && <p className="small" style={{ margin: "4px 0 0" }}><Link href={`/map/${imp.step.process}#${imp.step.id}`}>← Back to the map: {imp.step.processTitle}</Link></p>}
      <form action="/impact" className="ctas" style={{ margin: "14px 0 22px", alignItems: "stretch", flexWrap: "nowrap" }}>
        <input name="q" defaultValue={imp ? "" : q} placeholder="Find a step: ocean acidification, snowmelt, fertiliser…" aria-label="Find a step" style={inputStyle} />
        <button className="btn primary big" type="submit">Find</button>
      </form>
      {!imp && q.trim().length >= 2 && hits.length === 0 && <p className="muted">Nothing matched. Try a shorter word.</p>}
      {!imp && hits.length > 0 && <div className="card"><div className="label small muted" style={{ marginBottom: 6 }}>Pick a step</div>{hits.map(s => <Link key={s.id} href={`/impact?step=${s.id}`} className="qrow"><span>{ell(s.label, 120)}</span><span className="small muted" style={{ marginLeft: "auto", flex: "none" }}>{s.processTitle}</span></Link>)}</div>}
      {step && !w.steps[step] && <p className="muted">That step is not on the map.</p>}
      {imp && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="small muted" style={{ textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700 }}>Starting from</div>
            <h2 style={{ margin: "4px 0 2px", fontSize: 22 }}>{imp.step.label}</h2>
            <p className="small muted" style={{ margin: 0 }}>in <Link href={`/map/${imp.step.process}#${imp.step.id}`}>{imp.step.processTitle}</Link> · {imp.reached} step{imp.reached === 1 ? "" : "s"} downstream within 6 lines</p>
          </div>
          {imp.rows.length === 0 && <p className="muted">Nothing on the map follows this step yet. That is a gap worth filling.</p>}
          <div className="htable">
            {imp.rows.map(r => (
              <details key={r.step} className="hrow">
                <summary style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "11px 14px", cursor: "pointer", listStyle: "none" }}>
                  <span><b>{SIGN[r.sign]}</b> {r.label} <span className="small muted">· {r.processTitle}</span></span>
                  <span className="small muted" style={{ whiteSpace: "nowrap" }}>{strengthWord(r.strength)} · {r.hops} line{r.hops === 1 ? "" : "s"}{r.elasticity != null ? ` · elasticity ${r.elasticity}` : ""}</span>
                </summary>
                <div className="hyp-body" style={{ padding: "4px 14px 14px" }}>
                  <ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                    {r.chain.map((h, i) => (
                      <li key={i} style={{ margin: "6px 0" }}>
                        {h.edge ? <>
                          <Link href={`/map/${w.steps[h.from]?.process}#${h.from}`}>{ell(h.fromLabel, 90)}</Link> <span className="muted">→</span> <Link href={`/map/${w.steps[h.to]?.process}#${h.to}`}>{ell(h.toLabel, 90)}</Link>
                          <div className="small muted">{h.dir}{h.size}/5{h.prob != null ? `, ${h.prob}% of the fork` : ""}{h.elasticity != null ? `, elasticity ${h.elasticity}` : ""}: {h.note}</div>
                          {h.sources && h.sources.length > 0 && <details><summary className="small muted">sources ({h.sources.length})</summary><ul className="ev">{h.sources.map((s, j) => <li key={j} className="small"><Linked text={s} /></li>)}</ul></details>}
                        </> : <span className="small muted">{h.kind === "enter" ? "enters the subprocess" : "leaves the subprocess"} {ell(h.toLabel, 90)}</span>}
                      </li>
                    ))}
                  </ol>
                  <p className="small" style={{ margin: "10px 0 0" }}><Link href={`/impact?step=${r.step}`}>What this step changes in turn →</Link></p>
                </div>
              </details>
            ))}
          </div>
          <p className="muted small" style={{ marginTop: 14 }}>Strength is the product of each line&apos;s size as a fraction of five, scaled by fork shares; it ranks effects and is not a measurement. Where every line on a chain carries an elasticity, the composed elasticity is shown: the percent change at the end per one percent change at the start.</p>
        </>
      )}
    </div>
  );
}
