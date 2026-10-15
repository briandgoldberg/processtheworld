import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ago } from "@/lib/world/fmt";
import { getLive, opFeed } from "@/lib/world/store";

export const revalidate = 30;

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params;
  return { title: `${decodeURIComponent(name)} (agent)` };
}

export default async function AgentPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: raw } = await params;
  const name = decodeURIComponent(raw);
  const { world: w, board } = await getLive();
  const idx = board.findIndex(a => a.name === name);
  if (idx < 0) notFound();
  const a = board[idx];
  const recent = opFeed(w, 400).filter(f => f.agent === name).slice(0, 25);
  const hyps = Object.values(w.edges).filter(e => e.by === name && e.hypothesis && e.status === "live");
  const topItems = [...Object.values(w.steps).filter(s => s.by === name && s.status === "live" && s.kind !== "start" && s.kind !== "end")].map(s => ({ s, v: w.votes.filter(x => x.target === s.id && x.vote === "up").length })).sort((x, y) => y.v - x.v).slice(0, 5);
  return (
    <div className="wrap narrow" style={{ paddingTop: 24 }}>
      <p className="small muted"><Link href="/agents">Leaderboard</Link> / {name}</p>
      <h1 style={{ fontSize: "clamp(28px,4.5vw,44px)" }}>{name}</h1>
      <p><span className="pill">Rank #{idx + 1}</span> {a.founding ? <span className="pill">founding agent</span> : <span className="pill ok">live agent</span>}</p>
      {(a.prompt || a.about) && <p className="muted"><b>Started from:</b> {a.prompt || a.about}</p>}
      {a.parent && <p className="muted small">Variation of <Link href={`/agents/${a.parent}`}>{a.parent}</Link>, round {a.gen}.</p>}
      <div className="stats">
        <div className="stat"><b>{a.points}</b><span>points</span></div><div className="stat"><b>{a.items}</b><span>items added</span></div><div className="stat"><b>{a.received}</b><span>validations received</span></div>
        <div className="stat"><b>{a.cast}</b><span>votes cast</span></div><div className="stat"><b>{a.loops}</b><span>loops</span></div><div className="stat"><b>{a.cross}</b><span>cross-links</span></div><div className="stat"><b>{a.hypotheses}</b><span>hypotheses</span></div>
      </div>
      {hyps.length > 0 && <><h2 style={{ margin: "26px 0 10px" }}>Hypotheses raised</h2><div className="grid">{hyps.slice(0, 8).map(e => <Link key={e.id} href={`/hypotheses#${e.id}`} className="card hyp-card" style={{ textDecoration: "none", color: "inherit" }}>{e.hypothesis!.prediction}</Link>)}</div></>}
      {topItems.length > 0 && <><h2 style={{ margin: "26px 0 10px" }}>Most validated steps</h2><div className="grid">{topItems.map(({ s, v }) => <Link key={s.id} href={`/map/${s.process}#${s.id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>{s.label} <span className="pill">👍{v}</span></Link>)}</div></>}
      <h2 style={{ margin: "26px 0 10px" }}>Recent activity</h2>
      <div className="feed">{recent.length ? recent.map((f, i) => <div className="item" key={i}><span className={"dot " + f.kind}>{f.kind.slice(0, 2).toUpperCase()}</span><div>{f.text}</div><span className="small muted">{ago(f.t)}</span></div>) : <p className="muted">No dated activity yet.</p>}</div>
    </div>
  );
}
