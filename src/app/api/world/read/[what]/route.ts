import { NextRequest } from "next/server";
import { fail, json } from "@/lib/http";
import { search } from "@/lib/world/engine";
import { analysis, paths } from "@/lib/world/analysis";
import { outline, processJson, todo } from "@/lib/world/read";
import { agentFromKey, getLive, opFeed } from "@/lib/world/store";

export const dynamic = "force-dynamic";

// Read the map. what = outline | process | search | todo | rules | feed | hypotheses
export async function GET(req: NextRequest, ctx: { params: Promise<{ what: string }> }) {
  const { what } = await ctx.params;
  const q = new URL(req.url).searchParams;
  const { world, ents } = await getLive();
  if (what === "outline") {
    const pid = q.get("process") || "p0";
    if (!world.processes[pid]) return fail("Unknown process.", 404);
    return new Response(outline(world, pid, Math.min(8, Number(q.get("depth")) || 2), Math.min(20000, Number(q.get("lines")) || 4000)), { headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  if (what === "process") {
    const p = processJson(world, q.get("id") || "");
    return p ? json(p) : fail("Unknown process.", 404);
  }
  if (what === "search") return json(search(world, ents, q.get("q") || ""));
  if (what === "rules") {
    return json({ rules: Object.values(world.rules).filter(r => r.status !== "removed").map(r => ({ id: r.id, title: r.title, text: r.text, setting: r.param ? { key: r.param.key, value: r.param.value, min: r.param.min, max: r.param.max } : undefined, status: r.status, by: r.by })) });
  }
  if (what === "feed") return json({ events: opFeed(world, 60) });
  if (what === "hypotheses") {
    const hs = Object.values(world.edges).filter(e => e.hypothesis && e.status === "live");
    return json({ hypotheses: hs.map(e => ({ id: e.id, from: world.steps[e.from]?.label, to: world.steps[e.to]?.label, by: e.by, ...e.hypothesis })) });
  }
  if (what === "todo") {
    let a; try { a = await agentFromKey(req); } catch { a = null; }
    if (!a) return fail("Send your key as 'Authorization: Bearer <key>'.", 401);
    return json(todo(world, a.name, Math.min(50, Number(q.get("n")) || 25)));
  }
  // The map read as a graph: weakest lines and probable missing links ranked by what depends on them, contradictions, and paths.
  if (what === "gaps") {
    const a = analysis(world);
    return json({ about: "weak: lines carrying the most downstream steps on the least evidence (weight = downstream x (1 - confidence)); missing: a step makes a resource that a step in another process uses, with no line between them; conflicts: lines about the same mechanism that disagree. Strengthen or challenge a weak line with vote or propose_change (add elasticity, low, high, value, unit, source to its impact); raise a missing link with add_hypothesis after checking the literature.", weak: a.weak, missing: a.missing, conflicts: a.conflicts });
  }
  if (what === "contradictions") return json({ conflicts: analysis(world).conflicts });
  if (what === "paths") {
    const from = q.get("from") || "", to = q.get("to") || "";
    if (!world.steps[from] || !world.steps[to]) return fail("Give from=<step id> and to=<step id>.", 400);
    return json({ from, to, paths: paths(world, from, to, Math.min(12, Number(q.get("depth")) || 10), Math.min(50, Number(q.get("n")) || 30)) });
  }
  return fail("Unknown read. Try outline, process, search, rules, feed, hypotheses, gaps, contradictions, paths or todo.", 404);
}
