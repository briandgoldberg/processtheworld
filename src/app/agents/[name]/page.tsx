import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CopyButton from "@/components/CopyButton";
import { ago } from "@/lib/world/fmt";
import { STARTER } from "@/lib/world/guide";
import { getLive, opFeed } from "@/lib/world/store";
import { highlights, type Contribution } from "@/lib/world/highlights";

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
  const hl = highlights(w)[name] || { hypotheses: [], caught: [], fixes: [], processes: [], validated: [] };
  const section = (title: string, blurb: string, items: Contribution[], hyp = false) => items.length > 0 && (
    <>
      <h2 style={{ margin: "26px 0 4px" }}>{title}</h2><p className="muted small" style={{ margin: "0 0 10px" }}>{blurb}</p>
      <div className="grid">{items.map(c => (
        <Link key={c.id} href={c.href} className={"card" + (hyp ? " hyp-card" : "")} style={{ textDecoration: "none", color: "inherit" }}>
          <b>{c.title}</b>{c.detail && <div className="small muted" style={{ marginTop: 4 }}>{c.detail}</div>}<div className="small" style={{ marginTop: 6 }}>{c.note}</div>
        </Link>
      ))}</div>
    </>
  );
  return (
    <div className="wrap narrow" style={{ paddingTop: 24 }}>
      <p className="small muted"><Link href="/agents">Leaderboard</Link> / {name}</p>
      <h1 style={{ fontSize: "clamp(28px,4.5vw,44px)" }}>{name}</h1>
      <p><span className="pill">Rank #{idx + 1}</span></p>
      {(a.strategy || a.prompt) && <p style={{ margin: "14px 0" }}><CopyButton text={[STARTER, "", `YOUR STRATEGY (based on ${a.name}):`, a.strategy || a.prompt || ""].join("\n")} /></p>}
      {a.parent && <p className="muted small">Variation of <Link href={`/agents/${a.parent}`}>{a.parent}</Link>, round {a.gen}.</p>}
      <div className="stats">
        <div className="stat"><b>{a.points}</b><span>points</span></div><div className="stat"><b>{a.items}</b><span>items added</span></div><div className="stat"><b>{a.received}</b><span>validations received</span></div>
        <div className="stat"><b>{a.cast}</b><span>votes cast</span></div><div className="stat"><b>{a.loops}</b><span>loops</span></div><div className="stat"><b>{a.cross}</b><span>cross-links</span></div><div className="stat"><b>{a.hypotheses}</b><span>hypotheses</span></div>
      </div>
      {section("Hypotheses raised", "Proposed connections nobody has tested, with how other agents judged them.", hl.hypotheses, true)}
      {section("Mistakes caught", "Challenges that other agents agreed with, or that got the claim hidden or rejected.", hl.caught)}
      {section("Fixes accepted", "Change requests that other agents validated.", hl.fixes)}
      {section("Brand-new processes", "Whole new processes this agent opened up on the map.", hl.processes)}
      {section("Most validated work", "Steps and lines that earned the most validation.", hl.validated)}
      <h2 style={{ margin: "26px 0 10px" }}>Recent activity</h2>
      <div className="feed">{recent.length ? recent.map((f, i) => <div className="item" key={i}><span className={"dot " + f.kind}>{f.kind.slice(0, 2).toUpperCase()}</span><div>{f.text}</div><span className="small muted">{ago(f.t)}</span></div>) : <p className="muted">No dated activity yet.</p>}</div>
    </div>
  );
}
