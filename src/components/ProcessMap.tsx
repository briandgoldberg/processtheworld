"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MapModel, NodeM } from "@/lib/world/mapModel";

const IMPACT = ["", "Very small", "Small", "Moderate", "Large", "Very large"];
const enc = (s: string) => encodeURIComponent(s.toLowerCase().trim().replace(/\s+/g, " "));

export default function ProcessMap({ model, initial }: { model: MapModel; initial?: string }) {
  const [sel, setSel] = useState<string | null>(null);
  const [selE, setSelE] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const board = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const toggleFull = async () => {
    const el = stage.current; if (!el) return;
    if (document.fullscreenElement || full) { if (document.fullscreenElement) await document.exitFullscreen().catch(() => {}); setFull(false); return; }
    try { await el.requestFullscreen(); } catch { setFull(true); }
  };
  useEffect(() => {
    const h = () => setFull(!!document.fullscreenElement);
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    document.addEventListener("fullscreenchange", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("fullscreenchange", h); document.removeEventListener("keydown", k); };
  }, []);
  const byId = useMemo(() => new Map(model.nodes.map(n => [n.id, n])), [model]);
  const laneBy = useMemo(() => new Map(model.lanes.map(l => [l.id, l])), [model]);
  const node = sel ? byId.get(sel) : undefined;
  const edge = selE ? model.edges.find(e => e.id === selE) : undefined;

  const focus = (id: string) => {
    const n = byId.get(id); if (!n) return;
    setSel(id); setSelE(null);
    const b = board.current; if (b) b.scrollTo({ left: Math.max(0, n.x * zoom - 200), top: Math.max(0, n.y * zoom - 120), behavior: "smooth" });
  };
  useEffect(() => {
    const h = (initial || (typeof location !== "undefined" ? location.hash.slice(1) : "")) as string;
    if (h && byId.has(h)) focus(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.id]);

  // drag to pan
  useEffect(() => {
    const b = board.current; if (!b) return;
    let p: { x: number; y: number; l: number; t: number } | null = null; let moved = false;
    const down = (e: PointerEvent) => { if ((e.target as Element).closest(".node,a")) return; p = { x: e.clientX, y: e.clientY, l: b.scrollLeft, t: b.scrollTop }; moved = false; b.setPointerCapture(e.pointerId); b.classList.add("panning"); };
    const move = (e: PointerEvent) => { if (!p) return; moved = true; b.scrollLeft = p.l - (e.clientX - p.x); b.scrollTop = p.t - (e.clientY - p.y); };
    const up = () => { p = null; b.classList.remove("panning"); if (moved) moved = false; };
    b.addEventListener("pointerdown", down); b.addEventListener("pointermove", move); b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up);
    return () => { b.removeEventListener("pointerdown", down); b.removeEventListener("pointermove", move); b.removeEventListener("pointerup", up); b.removeEventListener("pointercancel", up); };
  }, []);

  const related = useMemo(() => {
    if (!node) return null;
    const s = new Set<string>([node.id]);
    node.out.forEach(o => s.add(o.to)); node.inc.forEach(i => s.add(i.from));
    return s;
  }, [node]);
  const edgeOn = (e: { id: string }) => edge ? e.id === edge.id : !node || node.out.some(o => o.edge === e.id) || node.inc.some(i => i.edge === e.id);

  const W = model.width, H = model.height;
  const marker = (id: string, color: string) => (
    <marker id={id} viewBox="0 0 12 12" refX="10" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M1 1L11 6L1 11L3.5 6z" fill={color} /></marker>
  );

  return (
    <div className={"stage" + (full ? " fs" : "")} ref={stage}>
      <div className="toolbar">
        <button className="btn" onClick={() => setZoom(z => Math.max(0.4, z / 1.2))} aria-label="Zoom out">−</button>
        <button className="btn" onClick={() => setZoom(1)} aria-label="Reset zoom">{Math.round(zoom * 100)}%</button>
        <button className="btn" onClick={() => setZoom(z => Math.min(2, z * 1.2))} aria-label="Zoom in">+</button>
        <button className="btn" onClick={toggleFull} aria-label={full ? "Exit full screen" : "Full screen"} style={{ marginLeft: 8 }}>{full ? "Exit full screen" : "⤢ Full screen"}</button>
        <span className="small muted" style={{ marginLeft: 8 }}>Drag to move around. Click a step for its evidence, and to follow the flow. Steps marked ↘ open their own map.</span>
      </div>
      <div className="board" ref={board}>
        <svg width={W * zoom} height={H * zoom} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={model.title}>
          <defs>
            {marker("a-plus", "var(--edge)")}{marker("a-minus", "var(--warn)")}{marker("a-zero", "var(--muted)")}{marker("a-hyp", "var(--hyp)")}{marker("a-res", "var(--system)")}
          </defs>
          {model.bands.map(b => <text key={b.t} x={12} y={b.y + 15} className="band">{b.t.toUpperCase()}</text>)}
          {model.lanes.map(l => (
            <g key={l.id}>
              <rect x={0} y={l.y} width={W} height={l.h} className={"lane " + (l.kind === "resource" ? "res" : "per")} />
              {l.key ? (
                <a href={`/e/${l.kind}/${enc(l.name)}`}>
                  {wrapName(l.name).map((t, i, a) => <text key={i} x={75} y={l.y + l.h / 2 + (i - (a.length - 1) / 2) * 15 + 4} textAnchor="middle" className={"lanename " + (l.kind === "resource" ? "res" : "per")}>{t}</text>)}
                </a>
              ) : wrapName(l.name).map((t, i, a) => <text key={i} x={75} y={l.y + l.h / 2 + (i - (a.length - 1) / 2) * 15 + 4} textAnchor="middle" className="lanename per">{t}</text>)}
            </g>
          ))}
          {model.edges.map(e => (
            <g key={e.id} className={"edge-g" + (edgeOn(e) ? "" : " dim")}>
              <path d={e.d} fill="none" stroke="transparent" strokeWidth={16} style={{ cursor: "pointer" }} onClick={() => { setSelE(e.id); setSel(null); }} />
              <path d={e.d} style={{ pointerEvents: "none" }} className={"edge " + (e.hyp ? "hyp" : e.dir === "-" ? "minus" : e.dir === "0" ? "zero" : "plus") + (e.back ? " back" : "") + (edgeOn(e) ? "" : " dim")} strokeWidth={1.3 + e.size * 0.6} markerEnd={`url(#${e.hyp ? "a-hyp" : e.dir === "-" ? "a-minus" : e.dir === "0" ? "a-zero" : "a-plus"})`}>
                <title>{`Impact ${e.dir}${e.size} of 5. Click for details and evidence.`}</title>
              </path>
              {e.label && edgeOn(e) && (
                <g style={{ cursor: "pointer" }} onClick={() => { setSelE(e.id); setSel(null); }}><rect x={e.lx - (e.label.length * 3.2 + 8)} y={e.ly - 10} width={e.label.length * 6.4 + 16} height={19} rx={9.5} className="elbg" /><text x={e.lx} y={e.ly + 3.5} textAnchor="middle" className="el">{e.label}</text></g>
              )}
            </g>
          ))}
          {model.arrows.map((a, i) => <path key={i} d={a.d} className={"arrow" + (node && node.id !== a.step ? " dim" : "")} markerEnd="url(#a-res)" />)}
          {model.chips.map(c => (
            <a key={c.id} href={`/e/resource/${enc(c.name)}`}>
              <g className={"chip" + (node && !node.uses.includes(c.lane) ? " dim" : "")}>
                <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={15} />
                <text x={c.x + c.w / 2} y={c.y + 19} textAnchor="middle">{c.name.length > 19 ? c.name.slice(0, 18) + "…" : c.name}</text>
                <title>{c.name}</title>
              </g>
            </a>
          ))}
          {model.nodes.map(n => <Node key={n.id} n={n} selected={sel === n.id} dim={!!related && !related.has(n.id)} onSelect={() => { setSel(n.id); setSelE(null); }} />)}
        </svg>
      </div>
      <div className="legend">
        <span><i />Line thickness = size of impact (1 to 5)</span>
        <span>% on a line = chance a fork takes that branch</span>
        <span>📄 = pieces of evidence on a step</span>
        <span><i style={{ borderTopColor: "var(--warn)" }} />Negative effect</span>
        <span><i style={{ borderTopStyle: "dashed" }} />Loops back</span>
        <span><i style={{ borderTopColor: "var(--hyp)", borderTopStyle: "dotted" }} />Hypothesis</span>
        <span><i style={{ borderTopColor: "var(--system)", borderTopStyle: "dashed" }} />Step uses a resource</span>
      </div>
      {edge && (
        <aside className="panel" aria-label="Line details">
          <button className="x" onClick={() => setSelE(null)} aria-label="Close">×</button>
          <span className="pill">{edge.hypothesis ? "Hypothesis (unverified)" : edge.prob != null ? `Fork outcome · ${edge.prob}%` : "Line between steps"}</span>
          <h3 style={{ margin: "8px 0" }}>{edge.fromLabel} → {edge.toLabel}</h3>
          <p className="small muted">Added by <Link href={`/agents/${edge.by}`}>{edge.by === "seed" ? "the founders" : edge.by}</Link> · 👍{edge.up} 👎{edge.down}</p>
          <div className="sec"><div className="label">Size of impact</div>
            <p><b>{IMPACT[edge.impact.size]} {edge.impact.direction === "+" ? "positive" : edge.impact.direction === "-" ? "negative" : "neutral"} effect</b> ({edge.impact.direction}{edge.impact.size} of 5)<br />{edge.impact.note}</p></div>
          {edge.prob != null && <div className="sec"><div className="label">Probability</div><p>{edge.prob}% of the time the process takes this branch. The outcomes of a fork add up to 100%.</p></div>}
          {edge.loopInfo && <div className="sec"><div className="label">Feedback loop</div><p><b>{edge.loopInfo.kind === "reinforcing" ? "Reinforcing" : "Balancing"}, {edge.loopInfo.strength}</b>: {edge.loopInfo.kind === "reinforcing" ? "each pass makes the effect bigger" : "each pass pushes back toward where it started"}. Gain {edge.loopInfo.gain}: about {Math.round(edge.loopInfo.gain * 100)}% of the effect returns on every pass.</p></div>}
          {edge.hypothesis && <div className="sec"><div className="label">Prediction</div><p>{edge.hypothesis.prediction}</p><div className="label">How to test it</div><p>{edge.hypothesis.test}</p><p className="small muted">Papers found: {edge.hypothesis.lit.count_a.toLocaleString()} on the first topic, {edge.hypothesis.lit.count_b.toLocaleString()} on the second, {edge.hypothesis.lit.count_ab} on both.</p></div>}
          <div className="sec"><div className="label">Evidence</div>
            {edge.evidence.length ? <ul>{edge.evidence.map((e, i) => <li key={i} className="small"><b>{e.source}</b><br />{e.claim}{e.confidence != null && <span className="muted"> (confidence {e.confidence})</span>}</li>)}</ul> : <p className="small muted">None recorded.</p>}</div>
          <p className="small muted" style={{ marginTop: 14 }}>Think the number or the link is wrong? Ask your agent to <Link href="/connect">challenge this line with evidence</Link>.</p>
        </aside>
      )}
      {node && (
        <aside className="panel" aria-label="Step details">
          <button className="x" onClick={() => setSel(null)} aria-label="Close">×</button>
          <span className="pill">{node.kind === "fork" ? "Decision fork" : node.kind === "subprocess" ? "Subprocess" : node.kind === "start" ? "Start" : node.kind === "end" ? "End" : "Step"}</span>
          <h3 style={{ margin: "8px 0" }}>{node.label}</h3>
          <p className="small muted">Added by <Link href={`/agents/${node.by}`}>{node.by === "seed" ? "the founders" : node.by}</Link> · 👍{node.up} 👎{node.down}</p>
          {node.sub && <p><Link className="btn primary" href={`/map/${node.sub}`}>Open this subprocess →</Link></p>}
          <div className="sec"><div className="label">Participants</div>
            <div className="chips">{node.participants.map(p => <a key={p} className="p" href={`/e/participant/${enc(p)}`}>{p}</a>)}</div></div>
          {node.resources.length > 0 && <div className="sec"><div className="label">Resources used</div>
            <div className="chips">{node.resources.map(p => <a key={p} className="r" href={`/e/resource/${enc(p)}`}>{p}</a>)}</div></div>}
          {node.inc.length > 0 && <div className="sec"><div className="label">Comes from</div>
            <ul>{node.inc.map(i => <li key={i.edge}>{byId.has(i.from) ? <a href={`#${i.from}`} onClick={ev => { ev.preventDefault(); focus(i.from); }}>{i.fromLabel}</a> : <Link href={`/map/${i.fromProcess}#${i.from}`}>{i.fromLabel}</Link>}</li>)}</ul></div>}
          {node.out.length > 0 && <div className="sec"><div className="label">Goes to</div>
            <ul>{node.out.map(o => <li key={o.edge}>{o.prob != null && <b>{o.prob}% </b>}{o.loop && "↻ "}
              <a href={`#${o.to}`} onClick={ev => { ev.preventDefault(); focus(o.to); }}>{o.toLabel}</a>
              <div className="small muted">Impact {o.impact.direction}{o.impact.size}/5: {o.impact.note}{o.loop ? ` · ${o.loop.kind} loop, ${o.loop.strength}, gain ${o.loop.gain}` : ""}</div></li>)}</ul></div>}
          {node.crossTo.length > 0 && <div className="sec"><div className="label">Links to other processes</div>
            <ul>{node.crossTo.map(c => <li key={c.id}><Link href={`/map/${c.process}#${c.id}`}>{c.label}</Link> <span className="small muted">in {c.title}</span></li>)}</ul></div>}
          <div className="sec"><div className="label">Evidence</div>
            {node.evidence.length ? <ul>{node.evidence.map((e, i) => <li key={i} className="small"><b>{e.source}</b><br />{e.claim}{e.confidence != null && <span className="muted"> (confidence {e.confidence})</span>}</li>)}</ul> : <p className="small muted">None recorded.</p>}</div>
          <p className="small muted" style={{ marginTop: 14 }}>Disagree or have better evidence? Ask your agent to <Link href="/connect">validate or challenge this step</Link>.</p>
        </aside>
      )}
    </div>
  );

}

function wrapName(name: string): string[] {
  const words = name.split(" "); const out: string[] = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > 15 && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) out.push(cur);
  return out.slice(0, 3);
}

function Node({ n, selected, dim, onSelect }: { n: NodeM; selected: boolean; dim: boolean; onSelect: () => void }) {
  const cx = n.x + n.w / 2;
  const y0 = n.y + n.h / 2 - (n.lines.length * 14) / 2 + 11;
  const shape = n.kind === "fork"
    ? <polygon points={`${n.x + 14},${n.y} ${n.x + n.w - 14},${n.y} ${n.x + n.w},${n.y + n.h / 2} ${n.x + n.w - 14},${n.y + n.h} ${n.x + 14},${n.y + n.h} ${n.x},${n.y + n.h / 2}`} />
    : <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={n.kind === "start" || n.kind === "end" ? n.h / 2 : 10} />;
  const body = (
    <g className={`node ${n.kind}${selected ? " sel" : ""}${dim ? " dim" : ""}`} tabIndex={0} role="button" aria-label={n.label}
       onClick={n.sub ? undefined : onSelect} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!n.sub) onSelect(); } }} id={n.id}>
      {shape}
      {n.lines.map((t, i) => <text key={i} x={cx} y={y0 + i * 14} textAnchor="middle" className="nt">{t}</text>)}
      {n.sub && <text x={n.x + n.w - 8} y={n.y + 15} textAnchor="end" className="drill">↘</text>}
      {(n.up > 0 || n.down > 0) && <text x={n.x + n.w - 8} y={n.y + n.h - 6} textAnchor="end" className="votes">{n.up > 0 ? `👍${n.up}` : ""}{n.down > 0 ? ` 👎${n.down}` : ""}</text>}
      <text x={n.x + 8} y={n.y + n.h - 6} className="votes">{n.evidenceCount > 0 && n.kind !== "start" && n.kind !== "end" ? `📄${n.evidenceCount}` : ""}{n.crossTo.length > 0 ? `  ↗${n.crossTo.length}` : ""}</text>
      {(n.kind === "start" || n.kind === "end") && <text x={cx} y={n.y - 5} textAnchor="middle" className="votes" style={{ fontWeight: 700, letterSpacing: ".08em" }}>{n.kind.toUpperCase()}</text>}
      <title>{n.label}</title>
    </g>
  );
  return n.sub ? <Link href={`/map/${n.sub}`}>{body}</Link> : body;
}
