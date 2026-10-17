import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Explorer, { type ExplorerData, type QuestionRow } from "@/components/Explorer";
import Tree from "@/components/Tree";
import { downstream } from "@/lib/world/analysis";
import { buildMap } from "@/lib/world/mapModel";
import { chanceOf, longShot, near5, ranking, shownHypothesis } from "@/lib/world/shown";
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

// The explorer, full page: walk through a process, search anything, read the open questions that touch it.
export default async function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { world: w } = await getLive();
  const model = buildMap(w, id);
  if (!model) notFound();
  const inHere = new Set(Object.values(w.steps).filter(s => s.process === id && s.status === "live").map(s => s.id));
  type Cur = { id: string; title?: string; scores?: { novel: number; accurate: number; testable: number; impact?: number }; cluster?: string };
  const byCur = new Map((curated as Cur[]).map(c => [c.id, c]));
  const rank = ranking(curated as Cur[]);
  const variantIds = new Set(rank.variants.map(v => v.item.id));
  const questions: QuestionRow[] = Object.values(w.edges).filter(e => e.hypothesis && e.status === "live" && (inHere.has(e.from) || inHere.has(e.to))).map(e => {
    const c = byCur.get(e.id); const A = w.steps[e.from], B = w.steps[e.to];
    const status: QuestionRow["status"] = c?.scores ? (variantIds.has(e.id) ? "variant" : shownHypothesis(c) ? "ranked" : longShot(c) ? "long shot" : "unassessed") : "unassessed";
    const p = e.hypothesis!.prediction;
    return { id: e.id, title: c?.title || (p.length > 110 ? p.slice(0, 107).trimEnd() + "…" : p), from: e.from, to: e.to, fromLabel: A?.label || "", toLabel: B?.label || "", fromProcess: A?.process || "", toProcess: B?.process || "", total: c?.scores && status !== "unassessed" ? near5(chanceOf(c.scores)) : undefined, status };
  }).sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
  const qByStep: Record<string, string[]> = {};
  for (const x of questions) { (qByStep[x.from] ||= []).push(x.id); (qByStep[x.to] ||= []).push(x.id); }
  const down: Record<string, number> = {};
  for (const n of model.nodes) down[n.id] = downstream(w, n.id);
  const data: ExplorerData = { questions, qByStep, downstream: down, totalQuestions: rank.main.length };
  return <div className="xp-page"><Explorer key={id} model={model} data={data} tree={<Tree w={w} current={id} crumbs={model.crumbs.map(c => c.id)} />} /></div>;
}
