import type { Metadata } from "next";
import Globe, { type WorldData } from "@/components/world/Globe";
import { FLOWS, sampleRoutes } from "@/lib/journeys/flows";
import { ranking } from "@/lib/world/shown";
import { getLive } from "@/lib/world/store";
import curated from "@/lib/world/curated.json";

export const metadata: Metadata = { title: "The living Earth", description: "Water, carbon and dust travelling the planet as hundreds of routes rolled on the map's real odds. Tap a thread to follow it, and find the questions nobody has tested where the threads cross." };
export const revalidate = 300;

// The globe: three travellers sampled as flows over the Earth, the shares read live from the map's forks.
export default async function WorldPage() {
  const { world: w } = await getLive();
  const share = (forkStep: string, target: string) => Object.values(w.edges).find(e => e.status === "live" && e.from === forkStep && e.to === target)?.prob;
  const routes = sampleRoutes(FLOWS, 240, share);
  const stepLabel: Record<string, string> = {};
  for (const f of FLOWS) for (const nd of Object.values(f.nodes)) { if (nd.step && w.steps[nd.step]) stepLabel[nd.step] = w.steps[nd.step].label; for (const l of nd.next || []) for (const id of [l.forkStep, l.target]) if (id && w.steps[id]) stepLabel[id] = w.steps[id].label; }
  const stepProcess: Record<string, string> = {}; for (const id of Object.keys(stepLabel)) stepProcess[id] = w.steps[id].process;
  // open questions on the map that touch the steps the Amazon chapter passes through
  const amazonSteps = new Set(["s_06qv9rv1c", "s_cl8rw78g8", "s_sxbirk6fh", "s_2ctusx6g8", "s_0sk8px6fz", "s_ddkzl37kj", "s1589", "s383", "s386"]);
  const questions = ranking(curated).main.map(c => ({ c, e: w.edges[c.id] })).filter(x => x.e && (amazonSteps.has(x.e.from) || amazonSteps.has(x.e.to))).slice(0, 5).map(x => ({ id: x.c.id, title: (x.c as { title?: string }).title || x.e.hypothesis?.prediction.slice(0, 110) || "" }));
  const data: WorldData = { flows: FLOWS.map(f => ({ id: f.id, title: f.title, traveller: f.traveller, plural: f.plural, color: f.color, ride: f.ride, nodes: Object.fromEntries(Object.values(f.nodes).map(nd => [nd.id, { name: nd.name, step: nd.step }])) })), routes, stepLabel, stepProcess, hotspots: [{ id: "amazon", name: "The Amazon", lat: -3, lon: -60, radius: 9, text: "Where the threads cross. Saharan dust settles on the forest, carbon from the world's cities is fixed in its leaves, and two fifths of its rain is water that rose from the forest itself.", questions }] };
  return <div className="wd-page"><Globe data={data} /></div>;
}
