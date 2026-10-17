import type { Metadata } from "next";
import Linked from "@/components/Linked";
import Link from "next/link";
import { notFound } from "next/navigation";
import Explorer, { type ConflictRow, type ExplorerData, type MissingRow, type QuestionRow, type WeakRow } from "@/components/Explorer";
import Tree from "@/components/Tree";
import { analysis, downstream, edgeConfidence, weakEdges, type WeakEdge } from "@/lib/world/analysis";
import { buildMap } from "@/lib/world/mapModel";
import { chanceOf, longShot, near5, ranking, shownHypothesis } from "@/lib/world/shown";
import { entHref, plural } from "@/lib/world/fmt";
import { getLive } from "@/lib/world/store";
import curated from "@/lib/world/curated.json";

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
  const inHere = new Set(Object.values(w.steps).filter(s => s.process === id && s.status === "live").map(s => s.id));
  const stepOut = (sid: string) => { const s = w.steps[sid]; return { id: sid, label: s?.label || sid, process: s?.process || "", processTitle: (s && w.processes[s.process]?.title) || "" }; };

  // open questions touching this process, with their assessment where one exists
  const byCur = new Map((curated as { id: string; title?: string; scores?: { novel: number; accurate: number; testable: number; impact?: number }; cluster?: string }[]).map(c => [c.id, c]));
  const rank = ranking(curated as { id: string; scores?: { novel: number; accurate: number; testable: number; impact?: number }; cluster?: string }[]);
  const variantIds = new Set(rank.variants.map(v => v.item.id));
  const questions: QuestionRow[] = Object.values(w.edges).filter(e => e.hypothesis && e.status === "live" && (inHere.has(e.from) || inHere.has(e.to))).map(e => {
    const c = byCur.get(e.id); const A = stepOut(e.from), B = stepOut(e.to);
    const status: QuestionRow["status"] = c?.scores ? (variantIds.has(e.id) ? "variant" : shownHypothesis(c) ? "ranked" : longShot(c) ? "long shot" : "unassessed") : "unassessed";
    const p = e.hypothesis!.prediction;
    return { id: e.id, title: c?.title || (p.length > 110 ? p.slice(0, 107).trimEnd() + "…" : p), from: e.from, to: e.to, fromLabel: A.label, toLabel: B.label, fromProcess: A.process, toProcess: B.process, total: c?.scores && status !== "unassessed" ? near5(chanceOf(c.scores)) : undefined, novel: c?.scores?.novel, accurate: c?.scores?.accurate, status, countAb: e.hypothesis!.lit.count_ab };
  }).sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
  const qByStep: Record<string, string[]> = {};
  for (const x of questions) { (qByStep[x.from] ||= []).push(x.id); (qByStep[x.to] ||= []).push(x.id); }

  // what the map draws: confidence per line and what follows each step
  const conf: Record<string, number> = {};
  for (const e of model.edges) { const real = w.edges[e.id]; if (real && !real.hypothesis) conf[e.id] = edgeConfidence(w, real).conf; }
  const down: Record<string, number> = {};
  for (const n of model.nodes) down[n.id] = downstream(w, n.id);

  const row = (x: WeakEdge): WeakRow => ({ id: x.id, from: x.from.id, to: x.to.id, fromLabel: x.from.label, toLabel: x.to.label, fromProcess: x.from.process, toProcess: x.to.process, conf: x.conf, downstream: x.downstream, note: x.impact.note, reasons: x.reasons });
  const weak = weakEdges(w, 12, e => inHere.has(e.from) || inHere.has(e.to)).map(row);
  const a = analysis(w);
  const conflicts: ConflictRow[] = a.conflicts.filter(c => [c.a.from, c.a.to, c.b.from, c.b.to].some(s => s.process === id)).map(c => ({ a: row(c.a), b: row(c.b), kind: c.kind, note: c.note }));
  const missing: MissingRow[] = a.missing.filter(m => m.from.process === id || m.to.process === id).map(m => ({ resource: m.resource, from: m.from, to: m.to, downstream: m.downstream }));
  const data: ExplorerData = { questions, weak, conflicts, missing, conf, downstream: down, qByStep, totals: { questions: rank.main.length, weak: a.weak.length, conflicts: a.conflicts.length, missing: a.missing.length } };

  const body = Object.values(w.steps).filter(s => s.process === id && s.status === "live" && s.kind !== "start" && s.kind !== "end");
  return (
    <div className="xp-page">
      <Explorer key={id} model={model} data={data} tree={<Tree w={w} current={id} crumbs={model.crumbs.map(c => c.id)} />} />
      <div className="wrap">
        <section className="section steplist">
          <h2 style={{ marginBottom: 6 }}>Every step in {model.title}, with its evidence</h2>
          <p className="muted small">The map as a list. {model.boundary?.start ? `Starts: ${model.boundary.start} ` : ""}{model.boundary?.end ? `Ends: ${model.boundary.end}` : ""}</p>
          {body.map(s => (
            <div className="row" id={s.id} key={s.id}>
              <b>{s.kind === "fork" ? "⑂ " : s.kind === "subprocess" ? "↘ " : ""}{s.sub ? <Link href={`/map/${s.sub}`}>{s.label}</Link> : s.label}</b>
              <div className="chips">{s.participants.map(p => <Link key={p} className="p" href={entHref("participant", p)} style={{ color: "var(--person)", background: "var(--person-bg)" }}>{p}</Link>)}{s.resources.map(p => <Link key={p} className="r" href={entHref("resource", p)} style={{ color: "var(--system)", background: "var(--system-bg)" }}>{p}</Link>)}</div>
              <details><summary className="small muted">Evidence ({s.evidence.length}){qByStep[s.id]?.length ? ` · ${plural(qByStep[s.id].length, "open question")}` : ""}</summary>
                <ul className="ev">{s.evidence.map((e, i) => <li key={i}><b><Linked text={e.source} /></b>: {e.claim}{e.confidence != null ? ` (confidence ${e.confidence})` : ""}</li>)}</ul></details>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
