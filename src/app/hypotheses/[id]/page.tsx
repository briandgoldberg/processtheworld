import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import HypothesisBody, { hypothesisTitle, type Assessment } from "@/components/HypothesisBody";
import { chanceOf } from "@/lib/world/shown";
import { getLive } from "@/lib/world/store";
import curated from "@/lib/world/curated.json";

export const revalidate = 30;

async function find(id: string) {
  const { world: w } = await getLive();
  const c = (curated as Assessment[]).find(x => x.id === id);
  const e = w.edges[id];
  if (!c && !(e && e.hypothesis)) return null;
  return { w, c };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const f = await find(id);
  if (!f) return { title: "Not found" };
  const title = hypothesisTitle(f.w, id, f.c);
  const pred = f.w.edges[id]?.hypothesis?.prediction;
  return { title: `${title} (hypothesis)`, description: (pred || f.c?.untested || "A proposed connection between parts of Earth's systems that nobody has tested.").slice(0, 200) };
}

export default async function HypothesisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = await find(id);
  if (!f) notFound();
  const { w, c } = f;
  return (
    <div className="wrap narrow" style={{ paddingTop: 24 }}>
      <p className="small muted" style={{ margin: "0 0 8px" }}><Link href="/hypotheses">← All hypotheses</Link></p>
      <h1 style={{ fontSize: "clamp(24px,4vw,36px)" }}>{hypothesisTitle(w, id, c)}</h1>
      {c?.scores && <p className="muted" style={{ margin: "4px 0 16px" }}><b>{chanceOf(c.scores)}%</b> chance it is new and would hold up if tested</p>}
      <HypothesisBody w={w} id={id} c={c} />
    </div>
  );
}
