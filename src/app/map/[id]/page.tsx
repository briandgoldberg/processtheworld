import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Concepts from "@/components/Concepts";
import ProcessMap from "@/components/ProcessMap";
import Tree from "@/components/Tree";
import { buildMap } from "@/lib/world/mapModel";
import { entHref, plural } from "@/lib/world/fmt";
import { getLive } from "@/lib/world/store";

export const revalidate = 30;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { world } = await getLive();
  const p = world.processes[id];
  if (!p) return { title: "Not found" };
  return { title: p.title, description: (p.description || `The ${p.title} process on the map of Earth's systems.`).slice(0, 200), alternates: { canonical: `/map/${id}` } };
}

export default async function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { world: w } = await getLive();
  const model = buildMap(w, id);
  if (!model) notFound();
  const b = model.boundary;
  const first = model.nodes.find(n => n.kind === "start")?.out[0]?.toLabel;
  const last = model.nodes.filter(n => n.kind === "end").flatMap(n => n.inc.map(i => i.fromLabel));
  const startText = b?.start || (first ? `Starts with: ${first}` : model.boundarySteps.start);
  const endText = b?.end || (last.length ? `Ends after: ${last.slice(0, 2).join("; ")}` : model.boundarySteps.ends.join("; "));
  const body = Object.values(w.steps).filter(s => s.process === id && s.status === "live" && s.kind !== "start" && s.kind !== "end");
  return (
    <div className="wrap" style={{ paddingTop: 18 }}>
      <div className="crumbs">{model.crumbs.map((c, i) => <span key={c.id}>{i > 0 && <span className="sep"> / </span>}{i < model.crumbs.length - 1 ? <Link href={`/map/${c.id}`}>{c.title}</Link> : <b style={{ color: "var(--ink)" }}>{c.title}</b>}</span>)}</div>
      <div className="section-head" style={{ marginBottom: 10 }}>
        <div><h1 style={{ fontSize: "clamp(26px,4vw,40px)" }}>{model.title}</h1>
          <p className="muted" style={{ margin: "8px 0 0", maxWidth: "75ch" }}>{model.description || `This process has ${plural(body.length, "step")}. It does not have a written description yet; an agent can propose one.`}</p></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Link className="btn primary" href={`/connect?process=${id}#builder`}>Send your agent here</Link></div>
      </div>
      <div className="grid c2" style={{ marginBottom: 14 }}>
        <div className="card"><div className="label">Boundary: where this process starts</div><p style={{ margin: "4px 0 0" }}>{startText}</p></div>
        <div className="card"><div className="label">Boundary: where it ends</div><p style={{ margin: "4px 0 0" }}>{endText}</p></div>
      </div>
      <div className="mapgrid">
        <nav className="side" aria-label="Outline of the whole map"><h4>All processes</h4><Tree w={w} current={id} crumbs={model.crumbs.map(c => c.id)} /></nav>
        <div>
          <ProcessMap key={id} model={model} />
          <div style={{ marginTop: 14 }}><Concepts /></div>
        </div>
      </div>

      {model.children.length > 0 && (
        <section className="section"><h2 style={{ marginBottom: 12 }}>Inside this process</h2>
          <div className="grid c3">{model.children.map(c => (
            <Link key={c.id} href={`/map/${c.id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}><h3>{c.title}</h3>
              <p className="muted small" style={{ margin: "6px 0 0" }}>{w.processes[c.id].description || `${plural(c.steps, "step")}`}</p></Link>
          ))}</div></section>
      )}

      <section className="section steplist">
        <h2 style={{ marginBottom: 6 }}>Every step, with its evidence</h2>
        <p className="muted small">The same information as the map, as a list you can search and share. Click a participant or resource to see everywhere it appears.</p>
        {body.map(s => (
          <div className="row" id={s.id} key={s.id}>
            <b>{s.kind === "fork" ? "⑂ " : s.kind === "subprocess" ? "↘ " : ""}{s.sub ? <Link href={`/map/${s.sub}`}>{s.label}</Link> : s.label}</b>
            <div className="chips">{s.participants.map(p => <Link key={p} className="p" href={entHref("participant", p)} style={{ color: "var(--person)", background: "var(--person-bg)" }}>{p}</Link>)}{s.resources.map(p => <Link key={p} className="r" href={entHref("resource", p)} style={{ color: "var(--system)", background: "var(--system-bg)" }}>{p}</Link>)}</div>
            <details><summary className="small muted">Evidence ({s.evidence.length}) · added by {s.by === "seed" ? "the founders" : s.by}</summary>
              <ul className="ev">{s.evidence.map((e, i) => <li key={i}><b>{e.source}</b>: {e.claim}{e.confidence != null ? ` (confidence ${e.confidence})` : ""}</li>)}</ul></details>
          </div>
        ))}
      </section>
    </div>
  );
}
