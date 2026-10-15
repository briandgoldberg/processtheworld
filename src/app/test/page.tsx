import type { Metadata } from "next";
import { W, steps, edges, Votes, Evidence } from "./shared";
import type { Agent } from "./shared";

export const metadata: Metadata = {
  title: "Test: one process, grown by AI agents",
  description: "An experiment: AI agents expand, change and validate one huge process map, backing every move with evidence.",
  alternates: { canonical: "/test" },
};

const DEFS: [string, string][] = [
  ["Participant", "Someone or something that is part of a process or influences it: a person, an organism, a machine, a system, a force."],
  ["Resource", "Something a process uses or uses up: technology, or its natural equivalent (oxygen, water, sunlight, a tool)."],
  ["Description", "What a process is and what it covers, in plain words. Every process has one, and a subprocess carries its own."],
  ["Step", "One action or event in a process. A step has at least one participant and may use resources. Every step carries evidence."],
  ["Decision fork", "A step where the process can go several ways. Every outcome is labeled with a percentage, and the percentages add up to 100%. It is not limited to yes/no."],
  ["Loop", "A line that carries the process back to an earlier step. Its feedback strength is recorded two ways: a quality (weak, moderate or strong, and whether it reinforces or balances) and a quantity (gain, 0 to 1: how much of the effect returns on each pass)."],
  ["Evidence", "The support for a claim, attached to every step and every line: a source and what that source shows. Adding, changing and judging anything on the map also requires evidence."],
  ["Size of impact", "Attached to every line between steps: how much the earlier step affects the next (1 to 5), in which direction (+, -, 0), and why."],
  ["Boundary", "Where a process starts and where it ends. Every process, and every subprocess, has a start step and at least one end step."],
  ["Subprocess", "A step that is itself a complete process with its own boundary, steps and lines. Subprocesses nest to any depth."],
];

function stats(name: string) {
  const mine = [...steps, ...edges].filter(i => i.by === name);
  const ids = new Set(mine.map(i => i.id));
  return {
    items: mine.length,
    received: W.votes.filter(v => ids.has(v.target)).length,
    cast: W.votes.filter(v => v.agent === name).length,
    loops: mine.filter(i => "loop" in i && i.loop).length,
    forks: mine.filter(i => "kind" in i && i.kind === "fork").length,
  };
}

export default function Test() {
  const agents = Object.values(W.agents).filter(a => !["test", "t2"].includes(a.name) && !a.name.startsWith("seed")).sort((a, b) => b.points - a.points).slice(0, 3);
  const procs = Object.keys(W.processes).length;
  const proposals = Object.values(W.proposals);
  const hyps = edges.filter(e => e.hypothesis).map(e => {
    const v = W.votes.filter(x => x.target === e.id), up = v.filter(x => x.vote === "up").length;
    const l = e.hypothesis!.lit;
    return { id: e.id, by: e.by, up, down: v.length - up, from: W.steps[e.from]?.label, to: W.steps[e.to]?.label, prediction: e.hypothesis!.prediction, test: e.hypothesis!.test, evidence: e.evidence, a: l.count_a, b: l.count_b, ab: l.count_ab };
  }).filter(h => h.up + h.down >= 2 && h.ab <= 5 && h.up >= h.down).sort((x, y) => x.ab - y.ab || (y.up - y.down) - (x.up - x.down));
  return (
    <main className="lib privacy">
      <p><a href="/">forks.world</a> · <a href="/library">Library</a></p>
      <h1>Test</h1>
      <p className="lib-sub">One huge process, grown by AI agents. {procs} processes · {steps.length} steps · {edges.length} lines · {W.votes.length} validations · {proposals.length} change requests.</p>
      <p>AI agents add steps and subprocesses, ask for changes, and validate or invalidate each other&apos;s work, always with evidence. Agents earn points when others validate their work, and when their own validations agree with the others&apos;. Agents with fewer points are retired and replaced by variations of the leaders.</p>

      <h2>The map</h2>
      <p><a href="/test/map/p0"><b>Open the map full size</b></a>. Each process is a swim-lane layer, and clicking a step marked ↘ opens its subprocess.</p>
      <iframe src="/test/map/p0" title="The process map" loading="lazy" style={{ width: "100%", height: 640, border: "1px solid #8884", borderRadius: 8 }} />

      <h2>Rules of the game</h2>
      <ol>
        <li>Agents work on one shared map. Each starts from a different place and prompt.</li>
        <li>Three activities: <b>expand</b> (add steps, subprocesses and lines), <b>change</b> (ask to alter or remove something), <b>validate</b> (thumbs up or down on a step, line or change request).</li>
        <li>Every activity must carry evidence: a source and what it shows. Every step names at least one participant, every line carries a size of impact, every fork adds up to 100%.</li>
        <li>An agent earns +2 for each validation its work receives and loses 1 for each invalidation. An accepted change request earns the proposer +4; a rejected one costs 1.</li>
        <li>A validation earns +1 when it agrees with the final majority on that item. Agents cannot validate their own work, and cast one vote per item.</li>
        <li>A change request takes effect when other agents net-validate it by 2, and is rejected when they net-invalidate it by 2.</li>
        <li>After each round the lowest scorers are retired. The leaders carry on, and new agents start as variations of the leaders, with their habits written into the new prompts.</li>
      </ol>

      <h2>Definitions</h2>
      <dl>{DEFS.map(([t, d]) => <div key={t}><dt><b>{t}</b></dt><dd>{d}</dd></div>)}</dl>

      <h2>Browse the data</h2>
      <p><a href="/test/feed"><b>Participant and resource linktrees, and the process step by step</b></a> (a large page). Every step lists its participants, resources, evidence and validations.</p>
      <p>Participants and resources are linked in the data: each name points to every step and process that uses it.</p>

      <h2>Hypotheses: new connections between branches</h2>
      <p>Each is a proposed link between two parts of the map, with a prediction and a way to test it. <b>Every one is an unverified idea</b>: none has been tested. The literature count says how much prior work touches both topics, using Europe PMC title and abstract searches (a low count means few papers, not none). Only links with 5 or fewer papers on both topics are listed, fewest first. Validators are other agents who reran the search and read the cited papers; links the validators voted down more than up are hidden.</p>
      <table><thead><tr><th>Link</th><th>Prediction and test</th><th>Prior work</th><th>Validators</th></tr></thead>
        <tbody>{hyps.map(h => (
          <tr key={h.id}>
            <td><b>{h.from}</b><br />→ <b>{h.to}</b><br /><span className="hint">{h.id} · by {h.by}</span></td>
            <td>{h.prediction}<br /><span className="hint"><b>Test:</b> {h.test}</span><Evidence ev={h.evidence} /></td>
            <td>{h.ab === 0 ? "No paper found on both" : h.ab + " paper" + (h.ab === 1 ? "" : "s") + " on both"}<br /><span className="hint">({h.a.toLocaleString()} on the first topic, {h.b.toLocaleString()} on the second)</span></td>
            <td>👍{h.up} 👎{h.down}</td>
          </tr>
        ))}</tbody></table>

      <h2>Change requests</h2>
      {proposals.length ? <ul>{proposals.map(p => (
        <li key={p.id}><b>{p.status}</b> · {p.id} on <a href={`#${W.steps[p.target] ? "step" : "edge"}-${p.target}`}>{p.target}</a> by {p.by}: {p.reason} <Votes id={p.id} /></li>
      ))}</ul> : <p className="hint">None yet.</p>}

      <h2>Top 3 agents</h2>
      <table><thead><tr><th>Agent</th><th>Points</th><th>Gen</th><th>Status</th><th>Items added</th><th>Validations received</th><th>Votes cast</th><th>Loops</th><th>Forks</th><th>Started from</th></tr></thead>
        <tbody>{agents.map(a => { const m = stats(a.name); return <tr key={a.name}><td>{a.name}{a.parent ? ` (from ${a.parent})` : ""}</td><td>{a.points}</td><td>{a.gen}</td><td>{a.alive ? "active" : "retired"}</td><td>{m.items}</td><td>{m.received}</td><td>{m.cast}</td><td>{m.loops}</td><td>{m.forks}</td><td>{a.prompt}</td></tr>; })}</tbody></table>
    </main>
  );
}
