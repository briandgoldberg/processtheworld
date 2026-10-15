import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { entityKey } from "@/lib/world/engine";
import { entHref, plural } from "@/lib/world/fmt";
import { getLive } from "@/lib/world/store";

export const revalidate = 30;
const TOP = 6;

async function find(kind: string, name: string) {
  if (kind !== "participant" && kind !== "resource") return null;
  const { world, ents } = await getLive();
  const decoded = decodeURIComponent(name);
  const e = ents.find(x => x.key === entityKey(kind, decoded));
  return e ? { world, ents, e } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ kind: string; name: string }> }): Promise<Metadata> {
  const { kind, name } = await params;
  const f = await find(kind, name);
  if (!f) return { title: "Not found" };
  return { title: `${f.e.name} (${kind})`, description: `Every process on the map of Earth's systems where ${f.e.name} appears as a ${kind}: ${plural(Object.keys(f.e.processes).length, "process")}, ${plural(f.e.steps.length, "step")}.`, alternates: { canonical: entHref(kind, f.e.name) } };
}

export default async function Entity({ params }: { params: Promise<{ kind: string; name: string }> }) {
  const { kind, name } = await params;
  const f = await find(kind, name);
  if (!f) notFound();
  const { world: w, ents, e } = f;
  const procs = Object.entries(e.processes).sort((a, b) => b[1] - a[1]).map(([pid, n]) => ({ pid, n, steps: e.steps.filter(id => w.steps[id].process === pid) }));
  // names that appear together with this one
  const together = new Map<string, number>();
  for (const id of e.steps) { const s = w.steps[id]; for (const [k, list] of [["participant", s.participants], ["resource", s.resources]] as const) for (const n of list) { if (k === kind && n.toLowerCase() === e.name.toLowerCase()) continue; const key = k + "|" + n; together.set(key, (together.get(key) || 0) + 1); } }
  const related = [...together.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => ({ kind: k.split("|")[0], name: k.split("|").slice(1).join("|"), n }));
  const row = (p: (typeof procs)[number]) => (
    <div key={p.pid} className="card" style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h3><Link href={`/map/${p.pid}`}>{w.processes[p.pid].title}</Link></h3><span className="pill">{plural(p.n, "step")}</span></div>
      <ul style={{ margin: "8px 0 0", paddingLeft: 18 }} className="small">{p.steps.slice(0, 3).map(id => <li key={id}><Link href={`/map/${p.pid}#${id}`}>{w.steps[id].label}</Link></li>)}{p.steps.length > 3 && <li className="muted">and {p.steps.length - 3} more in this process</li>}</ul>
    </div>
  );
  return (
    <div className="wrap narrow" style={{ paddingTop: 22 }}>
      <p className="small muted"><Link href="/search">Search</Link> / {kind}</p>
      <span className={"pill " + (kind === "resource" ? "sys" : "warn")}>{kind === "resource" ? "Resource: used or used up in processes" : "Participant: part of or influencing processes"}</span>
      <h1 style={{ fontSize: "clamp(30px,5vw,48px)", margin: "10px 0" }}>{e.name}</h1>
      <p className="muted">Appears in {plural(procs.length, "process").replace(/^(\d+) process(es)?$/, "$1 process$2")} and {plural(e.steps.length, "step")}. Everything below is linked: open a process to see it in context.</p>
      <h2 style={{ margin: "22px 0 10px" }}>Top processes</h2>
      {procs.slice(0, TOP).map(row)}
      {procs.length > TOP && <details><summary className="btn" style={{ display: "inline-flex" }}>Show {procs.length - TOP} more processes</summary><div style={{ marginTop: 10 }}>{procs.slice(TOP).map(row)}</div></details>}
      {related.length > 0 && (<><h2 style={{ margin: "26px 0 10px" }}>Often found with</h2>
        <div className="chips">{related.map(r => <Link key={r.kind + r.name} href={entHref(r.kind, r.name)} style={{ color: r.kind === "resource" ? "var(--system)" : "var(--person)", background: r.kind === "resource" ? "var(--system-bg)" : "var(--person-bg)", padding: "3px 10px", borderRadius: 999, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>{r.name} <span className="muted">{r.n}</span></Link>)}</div></>)}
      <p className="small muted" style={{ marginTop: 22 }}>Known by {ents.length.toLocaleString("en")} participants and resources across the map.</p>
    </div>
  );
}
