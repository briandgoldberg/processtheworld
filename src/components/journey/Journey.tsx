"use client";
// The journey: a 3D stage on top, the story and the choices beneath. The state is just the list of scenes visited and
// the dice rolls taken; everything shown comes from the live scene data the server bound to the map.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Scene, Stage } from "@/lib/journeys/raindrop";
import { RAINDROP_ROUTE, type Place } from "@/lib/journeys/raindropRoute";

export type SceneLive = Omit<Scene, "fork"> & {
  fork?: { step: string; options: { to: string; target: string; label: string; share?: number }[] };
  live?: { label: string; process: string; processTitle: string; evidence: number };
  question?: { id: string; title: string };
};
export type JourneyData = { id: string; title: string; intro: string; start: string; scenes: SceneLive[] };
export type Visit = { scene: string; stage: Stage; share?: number };

const Scene3D = dynamic(() => import("./Scene3D"), { ssr: false, loading: () => <div className="jy-stage jy-loading" /> });
const GlobeInset = dynamic(() => import("./GlobeInset"), { ssr: false });

export default function Journey({ data }: { data: JourneyData }) {
  const byId = useMemo(() => new Map(data.scenes.map(s => [s.id, s])), [data]);
  const [trail, setTrail] = useState<Visit[]>([{ scene: data.start, stage: byId.get(data.start)!.stage }]);
  const [rolling, setRolling] = useState<string | null>(null);
  const cur = byId.get(trail[trail.length - 1].scene)!;
  const go = useCallback((to: string, share?: number) => { const s = byId.get(to); if (!s) return; setTrail(t => [...t, { scene: to, stage: s.stage, share }]); }, [byId]);
  const roll = () => {
    if (!cur.fork || rolling) return;
    const opts = cur.fork.options.filter(o => o.share != null);
    const total = opts.reduce((a, o) => a + (o.share || 0), 0) || 1;
    let r = Math.random() * total; let pick = opts[opts.length - 1];
    for (const o of opts) { r -= o.share || 0; if (r <= 0) { pick = o; break; } }
    setRolling(pick.to);
    setTimeout(() => { setRolling(null); go(pick.to, (pick.share || 0) / total); }, 900);
  };
  const restart = () => setTrail([{ scene: data.start, stage: byId.get(data.start)!.stage }]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { if (cur.next) { e.preventDefault(); go(cur.next); } else if (cur.fork) { e.preventDefault(); roll(); } } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });
  const dice = trail.filter(v => v.share != null);
  const odds = dice.reduce((a, v) => a * (v.share || 1), 1);
  const rarity = odds > 0 ? Math.max(1, Math.round(1 / odds)) : 1;
  // likely routes read better as "67 in 100"; rare ones as "1 in 400"
  const oddsText = odds >= 0.1 ? `${Math.round(odds * 100)} in 100` : `1 in ${rarity}`;
  const passed = trail.map(v => byId.get(v.scene)?.question).filter((q, i, a): q is { id: string; title: string } => !!q && a.findIndex(x => x?.id === q.id) === i);
  const stepsTaken = trail.length - 1;
  // where on Earth: the route's typical places, for the globe inset and the card
  const visited = useMemo(() => trail.map(v => RAINDROP_ROUTE[v.scene]).filter((p): p is Place => !!p), [trail]);
  const nexts = useMemo(() => { const ids = cur.fork ? cur.fork.options.map(o => o.to) : cur.choice ? cur.choice.options.map(o => o.to) : cur.next ? [cur.next] : []; return ids.map(id => RAINDROP_ROUTE[id]).filter((p): p is Place => !!p); }, [cur]);
  const here = RAINDROP_ROUTE[cur.id];
  const share = async () => {
    const text = `I followed a raindrop through ${stepsTaken} real steps of the water cycle on forks.world and ended: ${cur.end?.title}. About ${oddsText} raindrops take this exact route.`;
    try { if (navigator.share) await navigator.share({ title: data.title, text, url: location.href }); else { await navigator.clipboard.writeText(text + " " + location.href); alert("Copied to your clipboard."); } } catch { /* cancelled */ }
  };
  return (
    <div className="jy">
      <div className="jy-top">
        <Scene3D trail={trail} scenes={byId} rolling={rolling} />
        <div className="jy-globe"><GlobeInset visited={visited} nexts={nexts} />{here && <div className="jy-globe-place">{here.place}</div>}</div>
      </div>
      <div className="jy-panel">
        <div className="jy-head">
          <span className="jy-kicker">{data.title}</span>
          <span className="jy-count">{stepsTaken === 0 ? "" : `${stepsTaken} step${stepsTaken === 1 ? "" : "s"}${dice.length ? ` · odds so far ${oddsText}` : ""}`}</span>
        </div>
        {!cur.end ? (
          <div className="jy-card" key={cur.id}>
            <div className="jy-stage-name">{cur.live?.processTitle || ""}{here && <span className="jy-where"> · {here.place}</span>}</div>
            <h2>{cur.title}</h2>
            {stepsTaken === 0 && <p className="jy-intro">{data.intro}</p>}
            <p className="jy-say">{cur.say}</p>
            {cur.live && <p className="jy-real">On the map: <Link href={`/map/${cur.live.process}#${cur.step}`}>{cur.live.label}</Link>{cur.live.evidence > 0 && <span className="muted"> · {cur.live.evidence} source{cur.live.evidence === 1 ? "" : "s"}</span>}</p>}
            {cur.question && <p className="jy-q">You just passed an open question nobody has tested: <Link href={`/hypotheses#${cur.question.id}`}>{cur.question.title}</Link></p>}
            {cur.next && <div className="jy-actions"><button className="btn primary big" onClick={() => go(cur.next!)}>Continue →</button></div>}
            {cur.fork && (
              <div className="jy-fork">
                <div className="jy-ask">A fork on the map. The odds are the map&apos;s own.</div>
                <div className="jy-options">
                  {cur.fork.options.map(o => <button key={o.to} className={"jy-opt" + (rolling === o.to ? " hit" : "")} onClick={() => go(o.to, o.share != null ? o.share / (cur.fork!.options.reduce((a, x) => a + (x.share || 0), 0) || 100) : undefined)} disabled={!!rolling}><b>{o.share != null ? `${o.share}%` : "?"}</b><span>{o.label}</span></button>)}
                </div>
                <button className="btn primary big" onClick={roll} disabled={!!rolling}>{rolling ? "Rolling…" : "Let the rain decide"}</button>
              </div>
            )}
            {cur.choice && (
              <div className="jy-fork">
                <div className="jy-ask">{cur.choice.ask}</div>
                <div className="jy-options">{cur.choice.options.map(o => <button key={o.to} className="jy-opt" onClick={() => go(o.to)}><span>{o.label}</span></button>)}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="jy-card jy-end" key={cur.id}>
            <div className="jy-stage-name">Journey&apos;s end</div>
            <h2>{cur.end.title}</h2>
            <p className="jy-say">{cur.end.say}</p>
            <div className="jy-stats">
              <div><b>{stepsTaken}</b><span>real steps</span></div>
              <div><b>{dice.length}</b><span>rolls of the dice</span></div>
              <div><b>{oddsText}</b><span>raindrops take this exact route</span></div>
            </div>
            <ol className="jy-path">{trail.map((v, i) => { const s = byId.get(v.scene)!; return <li key={i}>{s.title}{v.share != null && <span className="muted"> · {Math.round(v.share * 100)}%</span>}</li>; })}</ol>
            {passed.length > 0 && <p className="jy-q">Open questions you passed on the way: {passed.map((q, i) => <span key={q.id}>{i > 0 && " · "}<Link href={`/hypotheses#${q.id}`}>{q.title}</Link></span>)}</p>}
            <div className="jy-actions"><button className="btn primary big" onClick={restart}>Fall again</button><button className="btn big" onClick={share}>Share your route</button><Link className="btn big" href="/map/p2">See the water cycle on the map</Link></div>
          </div>
        )}
      </div>
    </div>
  );
}
