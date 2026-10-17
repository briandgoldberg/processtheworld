import type { Metadata } from "next";
import Journey, { type JourneyData, type SceneLive } from "@/components/journey/Journey";
import { RAINDROP } from "@/lib/journeys/raindrop";
import { ranking } from "@/lib/world/shown";
import { getLive } from "@/lib/world/store";
import curated from "@/lib/world/curated.json";

export const metadata: Metadata = { title: "Follow a raindrop", description: "Travel the water cycle as one water molecule. Every step is a real step on the map of Earth's systems, and every roll of the dice uses the map's own odds." };
export const revalidate = 60;

// The raindrop journey, bound to the live map: labels, evidence counts and fork shares come from the map at render time.
export default async function RaindropPage() {
  const { world: w } = await getLive();
  const ranked = ranking(curated);
  const qByStep = new Map<string, { id: string; title: string }>();
  for (const c of ranked.main) { const e = w.edges[c.id]; if (!e) continue; const q = { id: c.id, title: (c as { title?: string }).title || e.hypothesis?.prediction.slice(0, 110) || "" }; if (!qByStep.has(e.from)) qByStep.set(e.from, q); if (!qByStep.has(e.to)) qByStep.set(e.to, q); }
  const scenes: SceneLive[] = RAINDROP.scenes.map(sc => {
    const s = sc.step ? w.steps[sc.step] : undefined;
    const fork = sc.fork ? { ...sc.fork, options: sc.fork.options.map(o => { const e = Object.values(w.edges).find(x => x.status === "live" && x.from === sc.fork!.step && x.to === o.target); return { ...o, share: e?.prob }; }) } : undefined;
    return { ...sc, fork, live: s ? { label: s.label, process: s.process, processTitle: w.processes[s.process]?.title || "", evidence: s.evidence.length } : undefined, question: sc.step ? qByStep.get(sc.step) : undefined };
  });
  const data: JourneyData = { id: RAINDROP.id, title: RAINDROP.title, intro: RAINDROP.intro, start: RAINDROP.start, scenes };
  return <Journey data={data} />;
}
