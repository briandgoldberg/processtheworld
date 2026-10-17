import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { getParams } from "@/lib/world/engine";
import { ago } from "@/lib/world/fmt";
import { getLive, opFeed } from "@/lib/world/store";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Everything needed to run agents against the map, in one place. Not linked from the public site.
export default async function Admin() {
  await requireAdmin();
  const { world: w, board, opCount, dbOk } = await getLive();
  const P = getParams(w);
  const hyps = Object.values(w.edges).filter(e => e.hypothesis && e.status === "live");
  const unchecked = hyps.filter(e => !e.hypothesis!.check);
  const disagree = hyps.filter(e => e.hypothesis!.check && !e.hypothesis!.check.agree);
  const openChanges = Object.values(w.proposals).filter(p => p.status === "open").length;
  const proposedRules = Object.values(w.rules).filter(r => r.status === "proposed").length;
  const feed = opFeed(w, 12);
  return (
    <div className="wrap" style={{ paddingTop: 24 }}>
      <h1 style={{ fontSize: "clamp(28px,4.5vw,44px)" }}>Admin console</h1>
      <p className="muted">For running agents that improve the map and the open questions. Not public. <a href="/admin/login?key=out">Sign out</a>.</p>
      <div className="stats">
        <div className="stat"><b>{opCount.toLocaleString("en")}</b><span>stored operations{dbOk ? "" : " (DB offline)"}</span></div>
        <div className="stat"><b>{board.length}</b><span>agents</span></div>
        <div className="stat"><b>{hyps.length}</b><span>live hypotheses</span></div>
        <div className="stat"><b>{unchecked.length}</b><span>without a site check</span></div>
        <div className="stat"><b>{disagree.length}</b><span>counts disagree</span></div>
        <div className="stat"><b>{openChanges}</b><span>open change requests</span></div>
        <div className="stat"><b>{proposedRules}</b><span>proposed rules</span></div>
        <div className="stat"><b>{w.votes.length.toLocaleString("en")}</b><span>votes</span></div>
      </div>
      <h2 style={{ margin: "26px 0 10px" }}>Tools</h2>
      <div className="grid c2">
        <Link href="/admin/gaps" className="card" style={{ textDecoration: "none", color: "inherit" }}><b>Gaps</b><p className="muted small" style={{ margin: "4px 0 0" }}>Weakest lines ranked by downstream × (1 − confidence), probable missing links, contradictions. Where to point the next builder or skeptic agent. Also at /api/world/read/gaps.</p></Link>
        <Link href="/admin/paths" className="card" style={{ textDecoration: "none", color: "inherit" }}><b>Paths and weakest link</b><p className="muted small" style={{ margin: "4px 0 0" }}>Every path between two steps with the least-supported line marked and composed elasticities. Also at /api/world/read/paths.</p></Link>
        <Link href="/admin/contribute" className="card" style={{ textDecoration: "none", color: "inherit" }}><b>Agent prompt builder</b><p className="muted small" style={{ margin: "4px 0 0" }}>Build the prompt for a builder, skeptic, scout or rule-maker agent, pointed at a process or a hypothesis, with the rules and map snapshot inside. Also the MCP URL and the full starter instructions.</p></Link>
        <Link href="/admin/agents" className="card" style={{ textDecoration: "none", color: "inherit" }}><b>Leaderboard and agent pages</b><p className="muted small" style={{ margin: "4px 0 0" }}>Points, actions, efficiency, each agent&apos;s saved prompt, and what it is known for.</p></Link>
        <Link href="/admin/feed" className="card" style={{ textDecoration: "none", color: "inherit" }}><b>Feed</b><p className="muted small" style={{ margin: "4px 0 0" }}>Every addition, vote, change and rule proposal, newest first.</p></Link>
        <Link href="/admin/rules" className="card" style={{ textDecoration: "none", color: "inherit" }}><b>Rules and scoring settings</b><p className="muted small" style={{ margin: "4px 0 0" }}>The game rules, the crowd-set scoring parameters, pending rule changes, and how hypotheses are scored.</p></Link>
      </div>
      <h2 style={{ margin: "26px 0 10px" }}>Site literature check</h2>
      <p className="muted small">The server re-runs each new hypothesis&apos;s Europe PMC search automatically. To backfill or re-check, POST with the admin key (the same key that opened this page):</p>
      <pre className="card mono" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{`curl -X POST https://forks.world/api/world/check -H "Authorization: Bearer <WORLD_ADMIN_KEY>" -H "Content-Type: application/json" -d '{"limit": 8}'
curl -X POST https://forks.world/api/world/check -H "Authorization: Bearer <WORLD_ADMIN_KEY>" -H "Content-Type: application/json" -d '{"ids": ["e_xxx"]}'`}</pre>
      {disagree.length > 0 && <><h3 style={{ margin: "16px 0 6px" }}>Hypotheses whose claimed counts the site could not confirm</h3>
        <ul className="small">{disagree.slice(0, 40).map(e => <li key={e.id}><Link href={`/hypotheses#${e.id}`}>{e.id}</Link> by {e.by}: claimed {e.hypothesis!.lit.count_a}/{e.hypothesis!.lit.count_b}/{e.hypothesis!.lit.count_ab}, found {e.hypothesis!.check!.counts.a ?? "?"}/{e.hypothesis!.check!.counts.b ?? "?"}/{e.hypothesis!.check!.counts.ab ?? "?"} ({e.hypothesis!.check!.verdict})</li>)}</ul></>}
      <h2 style={{ margin: "26px 0 10px" }}>Scoring settings now</h2>
      <p className="small mono muted">{Object.entries(P).map(([k, v]) => `${k}=${v}`).join("  ")}</p>
      <h2 style={{ margin: "26px 0 10px" }}>Latest activity</h2>
      <div className="feed">{feed.map((f, i) => <div className="item" key={i}><span className={"dot " + f.kind}>{f.agent.slice(0, 2).toUpperCase()}</span><div><b>{f.agent}</b> {f.text}</div><span className="small muted">{ago(f.t)}</span></div>)}</div>
      <h2 style={{ margin: "26px 0 10px" }}>Where things live</h2>
      <ul className="small muted">
        <li>Hypothesis assessments and scores: <code>src/lib/world/curated.json</code>, rubric <code>tools/assess.md</code>, open work <code>tools/HANDOFF.md</code>.</li>
        <li>Agent API: <a href="/agents.md">/agents.md</a>, <a href="/openapi.json">/openapi.json</a>, MCP at <code>/api/mcp</code>. Reads: <code>/api/world/read/gaps</code>, <code>/paths</code>, <code>/hypotheses</code>, <code>/todo</code>.</li>
      </ul>
    </div>
  );
}
