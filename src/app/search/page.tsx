import type { Metadata } from "next";
import Link from "next/link";
import { search } from "@/lib/world/engine";
import { entHref, plural } from "@/lib/world/fmt";
import { getLive } from "@/lib/world/store";

export const metadata: Metadata = { title: "Search participants, resources and processes", description: "Look up any participant or resource on the map of Earth's systems and see every process that uses it." };
export const dynamic = "force-dynamic";
const TOP = 12;

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const { world: w, ents } = await getLive();
  const res = q.trim().length >= 2 ? search(w, ents, q, 30) : null;
  const people = ents.filter(e => e.kind === "participant"), resources = ents.filter(e => e.kind === "resource");
  const list = (items: typeof ents) => (
    <>
      <div className="grid c2">{items.slice(0, TOP).map(e => <EntityCard key={e.key} e={e} />)}</div>
      {items.length > TOP && <details style={{ marginTop: 10 }}><summary className="btn" style={{ display: "inline-flex" }}>Show {Math.min(items.length - TOP, 60)} more</summary>
        <div className="grid c2" style={{ marginTop: 10 }}>{items.slice(TOP, TOP + 60).map(e => <EntityCard key={e.key} e={e} />)}</div>
        <p className="small muted" style={{ marginTop: 8 }}>Use the search box for the other {Math.max(0, items.length - TOP - 60).toLocaleString("en")}.</p></details>}
    </>
  );
  return (
    <div className="wrap narrow" style={{ paddingTop: 24 }}>
      <h1 style={{ fontSize: "clamp(28px,4.5vw,44px)" }}>Search the map</h1>
      <p className="muted">Look up a participant (a plant, a microbe, a river) or a resource (water, oxygen, sunlight) and see every process it takes part in. You can also search processes and steps.</p>
      <form action="/search" style={{ display: "flex", gap: 8, margin: "14px 0 22px" }}>
        <input name="q" defaultValue={q} placeholder="Try: oxygen, earthworms, mycorrhizal fungi, nitrate…" style={{ flex: 1, border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 10, padding: "11px 14px" }} aria-label="Search" />
        <button className="btn primary" type="submit">Search</button>
      </form>
      {res ? (
        <>
          <h2 style={{ marginBottom: 10 }}>Results for “{q}”</h2>
          {res.entities.length > 0 && (<><h3 style={{ margin: "14px 0 8px" }}>Participants and resources</h3><div className="grid c2">{res.entities.map(e => <Link key={e.key} href={entHref(e.kind, e.name)} className="card" style={{ textDecoration: "none", color: "inherit" }}><b>{e.name}</b> <span className={"pill " + (e.kind === "resource" ? "sys" : "warn")}>{e.kind}</span><div className="small muted">{plural(e.processes, "process").replace("processs", "process")}, {plural(e.steps, "step")}</div></Link>)}</div></>)}
          {res.processes.length > 0 && (<><h3 style={{ margin: "18px 0 8px" }}>Processes</h3><div className="grid">{res.processes.map(p => <Link key={p.id} href={`/map/${p.id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>{p.title}</Link>)}</div></>)}
          {res.steps.length > 0 && (<><h3 style={{ margin: "18px 0 8px" }}>Steps</h3><div className="grid">{res.steps.map(s => <Link key={s.id} href={`/map/${s.process}#${s.id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>{s.label}<div className="small muted">in {s.processTitle}</div></Link>)}</div></>)}
          {!res.entities.length && !res.processes.length && !res.steps.length && <p className="muted">Nothing matched. Try a shorter word.</p>}
        </>
      ) : (
        <>
          <h2 style={{ margin: "8px 0 10px" }}>Top participants</h2>{list(people)}
          <h2 style={{ margin: "26px 0 10px" }}>Top resources</h2>{list(resources)}
        </>
      )}
    </div>
  );
}

function EntityCard({ e }: { e: { key: string; name: string; kind: string; steps: string[]; processes: Record<string, number> } }) {
  const n = Object.keys(e.processes).length;
  return (
    <Link href={entHref(e.kind, e.name)} className="card" style={{ textDecoration: "none", color: "inherit", padding: 14 }}>
      <b>{e.name}</b><div className="small muted">in {n} process{n === 1 ? "" : "es"} · {e.steps.length} step{e.steps.length === 1 ? "" : "s"}</div>
    </Link>
  );
}
