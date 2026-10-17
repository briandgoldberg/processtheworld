"use client";
// The explorer: one app for scientists. The map is the stage; a single inspector shows whatever you are looking at
// (the process with its open questions and weakest lines, then a step or a line with its evidence, its questions,
// what depends on it and the paths out of it); the search box is the command bar; confidence and open questions
// are layers drawn on the map itself. Works inside a page or full screen.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Linked from "@/components/Linked";
import type { MapModel, NodeM } from "@/lib/world/mapModel";

export type QuestionRow = { id: string; title: string; from: string; to: string; fromLabel: string; toLabel: string; fromProcess: string; toProcess: string; total?: number; novel?: number; accurate?: number; status: "ranked" | "long shot" | "variant" | "unassessed"; countAb: number };
export type WeakRow = { id: string; from: string; to: string; fromLabel: string; toLabel: string; fromProcess: string; toProcess: string; conf: number; downstream: number; note: string; reasons: string[] };
export type ConflictRow = { a: WeakRow; b: WeakRow; kind: string; note: string };
export type MissingRow = { resource: string; from: { id: string; label: string; process: string; processTitle: string }; to: { id: string; label: string; process: string; processTitle: string }; downstream: number };
export type ExplorerData = { questions: QuestionRow[]; weak: WeakRow[]; conflicts: ConflictRow[]; missing: MissingRow[]; conf: Record<string, number>; downstream: Record<string, number>; qByStep: Record<string, string[]>; totals: { questions: number; weak: number; conflicts: number; missing: number } };
type SearchHit = { entities: { key: string; name: string; kind: string; steps: number; processes: number }[]; processes: { id: string; title: string }[]; steps: { id: string; label: string; process: string; processTitle: string }[]; questions: { id: string; title: string; from: string; fromLabel: string; fromProcess: string; to: string; toLabel: string; toProcess: string }[] };
type PathHop = { step: { id: string; label: string; process: string; processTitle: string }; edge?: { id: string; impact: { size: number; direction: string; elasticity?: number }; conf: number; reasons: string[]; sources: string[]; loop: boolean } };
type PathRow = { hops: PathHop[]; weakest: number | null; sign: string; elasticity?: { value: number; low: number; high: number }; quantified: number; lines: number };

const ROLE_TEXT = { consumed: "Takes in and uses up", used: "Uses (not used up)", produced: "Makes or releases" } as const;
const IMPACT = ["", "Very small", "Small", "Moderate", "Large", "Very large"];
const enc = (s: string) => encodeURIComponent(s.toLowerCase().trim().replace(/\s+/g, " "));
const pct = (x: number) => `${Math.round(x * 100)}%`;
const ell = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const confClass = (c?: number) => (c == null ? "" : c < 0.35 ? " c-low" : c < 0.6 ? " c-mid" : " c-high");

export default function Explorer({ model, data, tree, embed = false, initialZoom = 1, extra }: { model: MapModel; data?: ExplorerData; tree?: ReactNode; embed?: boolean; initialZoom?: number; extra?: ReactNode }) {
  const router = useRouter();
  const [sel, setSel] = useState<string | null>(null);
  const [selE, setSelE] = useState<string | null>(null);
  const [zoom, setZoom] = useState(initialZoom);
  const [full, setFull] = useState(false);
  const [showTree, setShowTree] = useState(true);
  const [layerConf, setLayerConf] = useState(!embed);
  const [layerQ, setLayerQ] = useState(true);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit | null>(null);
  const [tracing, setTracing] = useState(false);
  const [paths, setPaths] = useState<{ to: string; toLabel: string; list: PathRow[] } | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const byId = useMemo(() => new Map(model.nodes.map(n => [n.id, n])), [model]);
  const hypEdges = useMemo(() => new Set(model.edges.filter(e => e.hyp).map(e => e.id)), [model]);
  const node = sel ? byId.get(sel) : undefined;
  const edge = selE ? model.edges.find(e => e.id === selE) : undefined;

  // full screen is a property of the page, so it survives moving between processes
  const KEY = "fw-fullscreen";
  const toggleFull = async () => {
    if (full) { try { sessionStorage.removeItem(KEY); } catch { /* private mode */ } if (document.fullscreenElement) await document.exitFullscreen?.()?.catch?.(() => {}); setFull(false); return; }
    try { sessionStorage.setItem(KEY, "1"); } catch { /* private mode */ }
    setFull(true);
    try { await document.documentElement.requestFullscreen?.(); } catch { /* the overlay still fills the window */ }
  };
  useEffect(() => {
    if (embed) return;
    let was = false; try { was = sessionStorage.getItem(KEY) === "1"; } catch { /* ignore */ }
    if (was || document.fullscreenElement) setFull(true);
    if (was && !document.fullscreenElement) { try { document.documentElement.requestFullscreen?.()?.catch?.(() => {}); } catch { /* not supported */ } }
    const h = () => { if (!document.fullscreenElement) { setFull(false); try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } } };
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, [embed]);
  useEffect(() => { document.body.style.overflow = full ? "hidden" : ""; document.body.classList.toggle("hide-fb", full); return () => { document.body.style.overflow = ""; document.body.classList.remove("hide-fb"); }; }, [full]);

  const focus = useCallback((id: string, openPanel = true) => {
    const n = byId.get(id); if (!n) return;
    if (openPanel) { setSel(id); setSelE(null); setPaths(null); setTracing(false); }
    const b = board.current; if (b) b.scrollTo({ left: Math.max(0, (n.x + n.w / 2) * zoom - b.clientWidth / 2), top: Math.max(0, (n.y + n.h / 2) * zoom - b.clientHeight / 2), behavior: "smooth" });
  }, [byId, zoom]);
  useEffect(() => {
    const h = typeof location !== "undefined" ? location.hash.slice(1) : "";
    if (h && byId.has(h)) setTimeout(() => focus(h), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.id]);

  // drag to pan
  useEffect(() => {
    const b = board.current; if (!b) return;
    let p: { x: number; y: number; l: number; t: number } | null = null;
    const down = (e: PointerEvent) => { if ((e.target as Element).closest(".node,a,.elbg,.el")) return; p = { x: e.clientX, y: e.clientY, l: b.scrollLeft, t: b.scrollTop }; b.setPointerCapture(e.pointerId); b.classList.add("panning"); };
    const move = (e: PointerEvent) => { if (!p) return; b.scrollLeft = p.l - (e.clientX - p.x); b.scrollTop = p.t - (e.clientY - p.y); };
    const up = () => { p = null; b.classList.remove("panning"); };
    b.addEventListener("pointerdown", down); b.addEventListener("pointermove", move); b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up);
    return () => { b.removeEventListener("pointerdown", down); b.removeEventListener("pointermove", move); b.removeEventListener("pointerup", up); b.removeEventListener("pointercancel", up); };
  }, []);
  // wheel + ctrl zooms around the cursor
  useEffect(() => {
    const b = board.current; if (!b) return;
    const wheel = (e: WheelEvent) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setZoom(z => Math.max(0.12, Math.min(2.5, z * (e.deltaY > 0 ? 0.9 : 1.1)))); };
    b.addEventListener("wheel", wheel, { passive: false });
    return () => b.removeEventListener("wheel", wheel);
  }, []);
  // keys: / searches, Escape backs out
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
      if (e.key === "/" && !typing && !embed) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape") { if (hits) setHits(null); else if (paths || tracing) { setPaths(null); setTracing(false); } else if (sel || selE) { setSel(null); setSelE(null); } else if (full) toggleFull(); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  // search: the command bar
  useEffect(() => {
    const s = q.trim(); if (s.length < 2) { setHits(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => { fetch(`/api/world/read/search?q=${encodeURIComponent(s)}`, { signal: ctl.signal }).then(r => r.json()).then(j => setHits(j)).catch(() => undefined); }, 180);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);
  const goStep = (id: string, process: string) => { setQ(""); setHits(null); if (byId.has(id)) focus(id); else router.push(`/map/${process}#${id}`); };
  const trace = async (toId: string, toLabel: string) => {
    if (!sel) return; setTracing(false); setQ(""); setHits(null);
    try { const j = await fetch(`/api/world/read/paths?from=${sel}&to=${toId}`).then(r => r.json()); setPaths({ to: toId, toLabel, list: j.paths || [] }); } catch { setPaths({ to: toId, toLabel, list: [] }); }
  };

  const related = useMemo(() => { if (!node) return null; const s = new Set<string>([node.id]); node.out.forEach(o => s.add(o.to)); node.inc.forEach(i => s.add(i.from)); return s; }, [node]);
  const labelsOn = zoom >= 0.75 || !!node || !!edge;
  const edgeOn = (e: { id: string }) => edge ? e.id === edge.id : !node || node.out.some(o => o.edge === e.id) || node.inc.some(i => i.edge === e.id);
  const W = model.width, H = model.height;
  const marker = (id: string, color: string) => <marker id={id} viewBox="0 0 12 12" refX="10" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M1 1L11 6L1 11L3.5 6z" fill={color} /></marker>;
  const openMarker = (id: string, color: string) => <marker id={id} viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M2 2L10 6L2 10" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></marker>;
  const conf = data?.conf || {};
  const qOf = (id: string) => (data?.qByStep[id] || []).map(qid => data!.questions.find(x => x.id === qid)).filter((x): x is QuestionRow => !!x);
  const weakOf = (id: string) => (data?.weak || []).filter(x => x.from === id || x.to === id);
  const crumbs = model.crumbs;

  const canvas = (
    <div className="xp-board" ref={board}>
      <svg width={W * zoom} height={H * zoom} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={model.title}>
        <defs>
          {marker("a-plus", "var(--edge)")}{marker("a-minus", "var(--warn)")}{marker("a-zero", "var(--muted)")}{marker("a-hyp", "var(--hyp)")}
          {openMarker("m-consumed", "var(--warn)")}{openMarker("m-used", "var(--system)")}{openMarker("m-produced", "var(--ok)")}
          <filter id="nshadow" x="-10%" y="-20%" width="120%" height="160%"><feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#0B1A3A" floodOpacity="0.14" /></filter>
          <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="var(--line)" /></pattern>
        </defs>
        <rect x={0} y={0} width={W} height={H} fill="url(#dots)" />
        {model.bands.map(b => <text key={b.t} x={12} y={b.y + 15} className="band">{b.t.toUpperCase()}</text>)}
        {model.lanes.map(l => (
          <g key={l.id}>
            <rect x={0} y={l.y} width={W} height={l.h} className={"lane " + (l.kind === "resource" ? "res" : "per")} />
            <rect x={8} y={l.y + 8} width={134} height={l.h - 16} rx={12} className={"lanetag " + (l.kind === "resource" ? "res" : "per")} />
            {l.key ? <a href={`/e/${l.kind}/${enc(l.name)}`}>{wrapName(l.name).map((t, i, a) => <text key={i} x={75} y={l.y + l.h / 2 + (i - (a.length - 1) / 2) * 15 + 4} textAnchor="middle" className={"lanename " + (l.kind === "resource" ? "res" : "per")}>{t}</text>)}</a>
              : wrapName(l.name).map((t, i, a) => <text key={i} x={75} y={l.y + l.h / 2 + (i - (a.length - 1) / 2) * 15 + 4} textAnchor="middle" className="lanename per">{t}</text>)}
          </g>
        ))}
        {model.edges.map(e => {
          const c = conf[e.id]; const hidden = e.hyp && !layerQ;
          if (hidden) return null;
          const cls = "edge " + (e.hyp ? "hyp" : e.dir === "-" ? "minus" : e.dir === "0" ? "zero" : "plus") + (e.back ? " back" : "") + (edgeOn(e) ? "" : " dim") + (layerConf && !e.hyp ? confClass(c) : "");
          return (
            <g key={e.id} className={"edge-g" + (edgeOn(e) ? "" : " dim")}>
              <path d={e.d} fill="none" stroke="transparent" strokeWidth={18} style={{ cursor: "pointer" }} onClick={() => { setSelE(e.id); setSel(null); setPaths(null); }} />
              <path d={e.d} style={{ pointerEvents: "none" }} className={cls} strokeWidth={1.3 + e.size * 0.6} markerEnd={`url(#${e.hyp ? "a-hyp" : e.dir === "-" ? "a-minus" : e.dir === "0" ? "a-zero" : "a-plus"})`}><title>{`Impact ${e.dir}${e.size} of 5${c != null ? `, confidence ${pct(c)}` : ""}. Click for details.`}</title></path>
              {e.label && edgeOn(e) && labelsOn && <g style={{ cursor: "pointer" }} onClick={() => { setSelE(e.id); setSel(null); }}><rect x={e.lx - (e.label.length * 3.2 + 8)} y={e.ly - 10} width={e.label.length * 6.4 + 16} height={19} rx={9.5} className="elbg" /><text x={e.lx} y={e.ly + 3.5} textAnchor="middle" className="el">{e.label}</text></g>}
            </g>
          );
        })}
        {model.arrows.map((a, i) => (
          <g key={i} className={"arrow-g" + (node && node.id !== a.step ? " dim" : "") + (node && node.id === a.step ? " on" : "")}>
            <path d={a.d} className={"arrow " + a.role} markerEnd={`url(#m-${a.role})`}><title>{`${byId.get(a.step)?.label}: ${a.label} ${a.name}`}</title></path>
            {labelsOn && (a.role !== "used" || node?.id === a.step) && <text x={a.lx + 5} y={a.ly + 3} className={"arrow-label " + a.role}>{a.label}</text>}
          </g>
        ))}
        {model.chips.map(c => (
          <a key={c.id} href={`/e/resource/${enc(c.name)}`}><g className={"chip " + c.role + (node && node.id !== c.step ? " dim" : "")}><rect x={c.x} y={c.y} width={c.w} height={c.h} rx={14} />{c.lines.map((t, i) => <text key={i} x={c.x + c.w / 2} y={c.y + (c.lines.length === 1 ? 22 : 15 + i * 12)} textAnchor="middle">{t}</text>)}<title>{c.name + ": " + c.text}</title></g></a>
        ))}
        {model.nodes.map(n => <Node key={n.id} n={n} selected={sel === n.id} dim={!!related && !related.has(n.id)} questions={layerQ ? (data?.qByStep[n.id]?.length || 0) : 0} weak={layerConf ? weakOf(n.id).some(x => x.conf < 0.35) : false} onSelect={() => { setSel(n.id); setSelE(null); setPaths(null); setTracing(false); }} />)}
      </svg>
    </div>
  );

  if (embed) return <div className="xp embed">{canvas}<div className="xp-foot"><span><i className="sw plus" />Positive</span><span><i className="sw minus" />Negative</span><span><i className="sw hyp" />Open question</span>{extra}</div></div>;

  // the inspector: what you are looking at
  const inspector = node ? (
    <div className="xp-insp" key={node.id}>
      <button className="x" onClick={() => { setSel(null); setPaths(null); }} aria-label="Close">×</button>
      <div className="kind">{node.kind === "fork" ? "Decision fork" : node.kind === "subprocess" ? "Subprocess" : node.kind === "start" ? "Start" : node.kind === "end" ? "End" : "Step"}{data && <span className="muted"> · {data.downstream[node.id] ?? 0} steps follow</span>}</div>
      <h3>{node.label}</h3>
      {node.sub && <p><Link className="btn primary" href={`/map/${node.sub}`}>Open this subprocess →</Link></p>}
      {qOf(node.id).length > 0 && <div className="sec"><div className="label">Open questions here</div>
        {qOf(node.id).map(x => <Link key={x.id} href={`/hypotheses#${x.id}`} className="qrow"><span className={"pill hyp"}>{x.total != null ? `${x.total}%` : x.status}</span><span>{x.title}</span></Link>)}</div>}
      {weakOf(node.id).length > 0 && <div className="sec"><div className="label">Weakest lines at this step</div>
        {weakOf(node.id).slice(0, 4).map(x => <button key={x.id} className="qrow asbtn" onClick={() => { setSelE(x.id); setSel(null); }}><span className={"pill" + confClass(x.conf)}>{pct(x.conf)}</span><span>{x.from === node.id ? `→ ${ell(x.toLabel, 70)}` : `← ${ell(x.fromLabel, 70)}`}</span></button>)}</div>}
      <div className="sec"><div className="label">Participants</div><div className="chips">{node.participants.map(p => <a key={p} className="p" href={`/e/participant/${enc(p)}`}>{p}</a>)}</div></div>
      {node.resourceUse.length > 0 && <div className="sec"><div className="label">Resources</div>
        {(["consumed", "used", "produced"] as const).map(role => { const items = node.resourceUse.filter(r => r.role === role); return items.length > 0 && <p key={role} className="small" style={{ margin: "6px 0 0" }}><b>{ROLE_TEXT[role]}:</b> {items.map((r, k) => <span key={r.name}>{k > 0 && "; "}<a href={`/e/resource/${enc(r.name)}`}>{r.name}</a>{r.note ? ` (${r.note})` : ""}</span>)}</p>; })}</div>}
      {node.inc.length > 0 && <div className="sec"><div className="label">Comes from</div><ul>{node.inc.map(i => <li key={i.edge}>{byId.has(i.from) ? <a href={`#${i.from}`} onClick={ev => { ev.preventDefault(); focus(i.from); }}>{i.fromLabel}</a> : <Link href={`/map/${i.fromProcess}#${i.from}`}>{i.fromLabel}</Link>}</li>)}</ul></div>}
      {node.out.length > 0 && <div className="sec"><div className="label">Goes to</div><ul>{node.out.map(o => <li key={o.edge}>{o.prob != null && <b>{o.prob}% </b>}{o.loop && "↻ "}<a href={`#${o.to}`} onClick={ev => { ev.preventDefault(); focus(o.to); }}>{o.toLabel}</a><div className="small muted">{o.impact.direction}{o.impact.size}/5{conf[o.edge] != null ? ` · confidence ${pct(conf[o.edge])}` : ""}: {o.impact.note}</div></li>)}</ul></div>}
      {node.crossTo.length > 0 && <div className="sec"><div className="label">Links to other processes</div><ul>{node.crossTo.map(c => <li key={c.id}><Link href={`/map/${c.process}#${c.id}`}>{c.label}</Link> <span className="small muted">in {c.title}</span></li>)}</ul></div>}
      <div className="sec"><div className="label">Trace a path from here</div>
        {!tracing && !paths && <button className="btn small-btn" onClick={() => { setTracing(true); setTimeout(() => searchRef.current?.focus(), 30); }}>Pick a destination…</button>}
        {tracing && <p className="small muted">Type the destination in the search box above and choose a step.</p>}
        {paths && <div><p className="small" style={{ margin: "0 0 6px" }}>To <b>{paths.toLabel}</b>: {paths.list.length ? `${paths.list.length} path${paths.list.length === 1 ? "" : "s"}, shortest first` : "no forward path within 10 lines"} <button className="small asbtn" onClick={() => setPaths(null)}>clear</button></p>
          {paths.list.slice(0, 6).map((p, i) => <div key={i} className="path">
            <div className="small muted">{p.lines} lines · sign {p.sign}{p.elasticity ? ` · composed elasticity ${p.elasticity.value} (${p.elasticity.low} to ${p.elasticity.high})` : p.lines ? ` · ${p.quantified}/${p.lines} quantified` : ""}</div>
            <ol>{p.hops.map((h, k) => <li key={k} className={p.weakest === k ? "weak" : ""}>{h.edge && <span className={"pill" + confClass(h.edge.conf)} title={h.edge.reasons.join(", ")}>{pct(h.edge.conf)}</span>} {byId.has(h.step.id) ? <a href={`#${h.step.id}`} onClick={ev => { ev.preventDefault(); focus(h.step.id); }}>{ell(h.step.label, 80)}</a> : <Link href={`/map/${h.step.process}#${h.step.id}`}>{ell(h.step.label, 80)}</Link>}{p.weakest === k && <span className="small" style={{ color: "var(--warn)" }}> weakest link</span>}</li>)}</ol>
          </div>)}</div>}
      </div>
      <div className="sec"><div className="label">Evidence</div>{node.evidence.length ? <ul>{node.evidence.map((e, i) => <li key={i} className="small"><b><Linked text={e.source} /></b><br />{e.claim}{e.confidence != null && <span className="muted"> (confidence {e.confidence})</span>}</li>)}</ul> : <p className="small muted">None recorded.</p>}</div>
      <p className="small muted mono">{node.id}</p>
    </div>
  ) : edge ? (
    <div className="xp-insp" key={edge.id}>
      <button className="x" onClick={() => setSelE(null)} aria-label="Close">×</button>
      <div className="kind">{edge.hypothesis ? "Open question (untested)" : edge.prob != null ? `Fork outcome · ${edge.prob}%` : "Line"}{conf[edge.id] != null && <span className={"pill" + confClass(conf[edge.id])} style={{ marginLeft: 8 }}>confidence {pct(conf[edge.id])}</span>}</div>
      <h3>{edge.fromLabel} <span className="muted">→</span> {edge.toLabel}</h3>
      <div className="sec"><div className="label">Impact</div><p><b>{IMPACT[edge.impact.size]} {edge.impact.direction === "+" ? "positive" : edge.impact.direction === "-" ? "negative" : "neutral"}</b> ({edge.impact.direction}{edge.impact.size} of 5). {edge.impact.note}</p>
        {(edge.impact.elasticity != null || edge.impact.value != null) ? <p className="small"><b>Quantified:</b>{edge.impact.elasticity != null && <> a 1% change in the first step changes the next by about {edge.impact.elasticity > 0 ? "+" : ""}{edge.impact.elasticity}%{edge.impact.low != null && edge.impact.value == null ? ` (range ${edge.impact.low} to ${edge.impact.high})` : ""}.</>}{edge.impact.value != null && <> {edge.impact.value} {edge.impact.unit}{edge.impact.low != null && edge.impact.elasticity == null ? ` (range ${edge.impact.low} to ${edge.impact.high})` : ""}.</>}{edge.impact.source && <span className="muted"> Source: <Linked text={edge.impact.source} /></span>}</p> : <p className="small muted">Not quantified: no rate or elasticity yet. A gap in itself.</p>}</div>
      {edge.loopInfo && <div className="sec"><div className="label">Feedback loop</div><p><b>{edge.loopInfo.kind === "reinforcing" ? "Reinforcing" : "Balancing"}, {edge.loopInfo.strength}</b>, gain {edge.loopInfo.gain}: about {Math.round(edge.loopInfo.gain * 100)}% of the effect returns each pass.</p></div>}
      {edge.hypothesis && <div className="sec"><div className="label">Prediction</div><p>{edge.hypothesis.prediction}</p><div className="label">How to test it</div><p>{edge.hypothesis.test}</p><p className="small muted">Papers: {edge.hypothesis.lit.count_a.toLocaleString()} on the first topic, {edge.hypothesis.lit.count_b.toLocaleString()} on the second, {edge.hypothesis.lit.count_ab} on both.</p><p><Link className="btn small-btn" href={`/hypotheses#${edge.id}`}>Scores, prior work and the site&apos;s check →</Link></p></div>}
      <div className="sec"><div className="label">Evidence</div>{edge.evidence.length ? <ul>{edge.evidence.map((e, i) => <li key={i} className="small"><b><Linked text={e.source} /></b><br />{e.claim}{e.confidence != null && <span className="muted"> (confidence {e.confidence})</span>}</li>)}</ul> : <p className="small muted">None recorded.</p>}</div>
      <p className="small muted"><Link href={`/paths?from=${edge.from}&to=${edge.to}`}>Other paths between these two steps</Link> · <span className="mono">{edge.id}</span></p>
    </div>
  ) : (
    <div className="xp-insp" key="process">
      <div className="kind">Process{model.parent && <> in <Link href={`/map/${model.parent.id}`}>{model.parent.title}</Link></>}</div>
      <h3>{model.title}</h3>
      {model.description && <p className="small muted">{model.description}</p>}
      {data && <>
        <div className="sec"><div className="label">Open questions in this process <span className="muted">({data.questions.length})</span></div>
          {data.questions.length === 0 && <p className="small muted">None yet.</p>}
          {data.questions.slice(0, 8).map(x => <Link key={x.id} href={`/hypotheses#${x.id}`} className="qrow" onMouseEnter={() => { if (byId.has(x.from)) focus(x.from, false); }}><span className="pill hyp">{x.total != null ? `${x.total}%` : x.status}</span><span>{x.title}</span></Link>)}
          {data.questions.length > 8 && <Link className="small" href="/hypotheses">All {data.totals.questions} open questions →</Link>}</div>
        <div className="sec"><div className="label">Weakest lines here</div>
          {data.weak.length === 0 && <p className="small muted">None.</p>}
          {data.weak.slice(0, 6).map(x => <button key={x.id} className="qrow asbtn" onClick={() => { setSelE(x.id); setSel(null); }}><span className={"pill" + confClass(x.conf)}>{pct(x.conf)}</span><span>{ell(x.fromLabel, 48)} → {ell(x.toLabel, 48)}<span className="muted"> · {x.downstream} follow</span></span></button>)}
          <Link className="small" href="/gaps">All gaps ranked by what depends on them →</Link></div>
        {data.conflicts.length > 0 && <div className="sec"><div className="label">Contradictions touching this process</div>
          {data.conflicts.slice(0, 4).map(c => <div key={c.a.id + c.b.id} className="qrow"><span className="pill warn">{c.kind}</span><span>{c.note}: <button className="asbtn link" onClick={() => { setSelE(c.a.id); setSel(null); }}>{ell(c.a.fromLabel, 36)} → {ell(c.a.toLabel, 36)}</button> vs <button className="asbtn link" onClick={() => { setSelE(c.b.id); setSel(null); }}>{ell(c.b.fromLabel, 36)} → {ell(c.b.toLabel, 36)}</button></span></div>)}</div>}
        {data.missing.length > 0 && <div className="sec"><div className="label">Probably missing links</div>
          {data.missing.slice(0, 4).map(m => <div key={m.resource + m.from.id + m.to.id} className="qrow"><span className="pill sys">{m.resource}</span><span>{byId.has(m.from.id) ? <a href={`#${m.from.id}`} onClick={ev => { ev.preventDefault(); focus(m.from.id); }}>{ell(m.from.label, 44)}</a> : <Link href={`/map/${m.from.process}#${m.from.id}`}>{ell(m.from.label, 44)}</Link>} → {byId.has(m.to.id) ? <a href={`#${m.to.id}`} onClick={ev => { ev.preventDefault(); focus(m.to.id); }}>{ell(m.to.label, 44)}</a> : <Link href={`/map/${m.to.process}#${m.to.id}`}>{ell(m.to.label, 44)}</Link>}</span></div>)}</div>}
      </>}
      {model.children.length > 0 && <div className="sec"><div className="label">Inside this process</div><ul>{model.children.map(c => <li key={c.id}><Link href={`/map/${c.id}`}>{c.title}</Link> <span className="small muted">{c.steps} steps</span></li>)}</ul></div>}
      <p className="small muted">Click a step or a line. Press / to search.</p>
    </div>
  );

  const results = hits && (hits.steps.length + hits.processes.length + hits.entities.length + hits.questions.length > 0 || q.trim().length >= 2) && (
    <div className="xp-results" role="listbox">
      {tracing && <div className="hint">Choose the destination step</div>}
      {hits.steps.length > 0 && <><h4>Steps</h4>{hits.steps.slice(0, 8).map(s => <button key={s.id} onClick={() => (tracing ? trace(s.id, s.label) : goStep(s.id, s.process))}><span>{ell(s.label, 90)}</span><span className="muted">{byId.has(s.id) ? "here" : s.processTitle}</span></button>)}</>}
      {!tracing && hits.questions.length > 0 && <><h4>Open questions</h4>{hits.questions.slice(0, 5).map(x => <button key={x.id} onClick={() => { setQ(""); setHits(null); if (byId.has(x.from)) focus(x.from); else router.push(`/map/${x.fromProcess}#${x.from}`); }}><span>{x.title}</span><span className="pill hyp">?</span></button>)}</>}
      {!tracing && hits.processes.length > 0 && <><h4>Processes</h4>{hits.processes.slice(0, 5).map(p => <button key={p.id} onClick={() => { setQ(""); setHits(null); router.push(`/map/${p.id}`); }}><span>{p.title}</span></button>)}</>}
      {!tracing && hits.entities.length > 0 && <><h4>Participants and resources</h4>{hits.entities.slice(0, 5).map(e => <button key={e.key} onClick={() => { setQ(""); setHits(null); router.push(`/e/${e.kind}/${enc(e.name)}`); }}><span>{e.name}</span><span className="muted">{e.kind} · {e.processes} processes</span></button>)}</>}
      {hits.steps.length + hits.processes.length + hits.entities.length + hits.questions.length === 0 && <div className="hint">Nothing matched. Try a shorter word.</div>}
    </div>
  );

  return (
    <div className={"xp" + (full ? " fs" : "") + (showTree ? "" : " notree")}>
      <div className="xp-top">
        <button className="btn icon" onClick={() => setShowTree(s => !s)} aria-label={showTree ? "Hide the outline" : "Show the outline"} title="Outline">☰</button>
        <nav className="xp-crumbs" aria-label="Process">{crumbs.map((c, i) => <span key={c.id}>{i > 0 && <span className="sep">/</span>}{i < crumbs.length - 1 ? <Link href={`/map/${c.id}`}>{c.title}</Link> : <b>{c.title}</b>}</span>)}</nav>
        <div className="xp-search">
          <input ref={searchRef} value={q} onChange={e => setQ(e.target.value)} placeholder={tracing ? "Destination step…" : "Search steps, questions, processes, resources  ( / )"} aria-label="Search" onKeyDown={e => { if (e.key === "Enter" && hits?.steps[0]) { const s = hits.steps[0]; tracing ? trace(s.id, s.label) : goStep(s.id, s.process); } }} />
          {results}
        </div>
        <div className="xp-layers" role="group" aria-label="Layers">
          <label className={layerConf ? "on" : ""} title="Colour lines by how well they are supported"><input type="checkbox" checked={layerConf} onChange={e => setLayerConf(e.target.checked)} /><span>Confidence</span></label>
          <label className={layerQ ? "on" : ""} title="Show untested connections"><input type="checkbox" checked={layerQ} onChange={e => setLayerQ(e.target.checked)} /><span>Open questions</span></label>
        </div>
        <div className="xp-zoom">
          <button className="btn icon" onClick={() => setZoom(z => Math.max(0.12, z / 1.2))} aria-label="Zoom out">−</button>
          <button className="btn icon wide" onClick={() => setZoom(initialZoom)} aria-label="Reset zoom">{Math.round(zoom * 100)}%</button>
          <button className="btn icon" onClick={() => setZoom(z => Math.min(2.5, z * 1.2))} aria-label="Zoom in">+</button>
          <button className="btn icon" onClick={toggleFull} aria-label={full ? "Exit full screen" : "Full screen"} title={full ? "Exit full screen (Esc)" : "Full screen"}>{full ? "⤡" : "⤢"}</button>
        </div>
      </div>
      <div className="xp-body">
        {showTree && <aside className="xp-tree" aria-label="All processes">{tree}</aside>}
        {canvas}
        <aside className="xp-side" aria-label="Details">{inspector}</aside>
      </div>
      <div className="xp-foot">
        <span><i className="sw plus" />Positive</span><span><i className="sw minus" />Negative</span><span><i className="sw loop" />Loops back</span><span><i className="sw hyp" />Open question</span>
        {layerConf && <><span><i className="sw c-low" />Low confidence</span><span><i className="sw c-high" />Well supported</span></>}
        <span className="muted">Thickness = size of impact · % = share of a fork · drag to pan, ctrl+scroll to zoom</span>
      </div>
    </div>
  );
}

function wrapName(name: string): string[] {
  const words = name.split(" "); const out: string[] = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > 15 && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) out.push(cur);
  return out.slice(0, 3);
}

function Node({ n, selected, dim, questions, weak, onSelect }: { n: NodeM; selected: boolean; dim: boolean; questions: number; weak: boolean; onSelect: () => void }) {
  const cx = n.x + n.w / 2;
  const y0 = n.y + n.h / 2 - (n.lines.length * 14) / 2 + 11;
  const shape = n.kind === "fork"
    ? <polygon points={`${n.x + 14},${n.y} ${n.x + n.w - 14},${n.y} ${n.x + n.w},${n.y + n.h / 2} ${n.x + n.w - 14},${n.y + n.h} ${n.x + 14},${n.y + n.h} ${n.x},${n.y + n.h / 2}`} />
    : <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={n.kind === "start" || n.kind === "end" ? n.h / 2 : 12} />;
  const body = (
    <g className={`node ${n.kind}${selected ? " sel" : ""}${dim ? " dim" : ""}${weak ? " weak" : ""}`} tabIndex={0} role="button" aria-label={n.label} filter="url(#nshadow)"
       onClick={n.sub ? undefined : onSelect} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!n.sub) onSelect(); } }} id={n.id}>
      {shape}
      {n.kind === "subprocess" && <rect x={n.x + 4} y={n.y - 4} width={n.w - 8} height={n.h} rx={12} className="stack" />}
      {n.lines.map((t, i) => <text key={i} x={cx} y={y0 + i * 14} textAnchor="middle" className="nt">{t}</text>)}
      {n.sub && <text x={n.x + n.w - 8} y={n.y + 15} textAnchor="end" className="drill">↘</text>}
      <text x={n.x + 8} y={n.y + n.h - 6} className="votes">{n.evidenceCount > 0 && n.kind !== "start" && n.kind !== "end" ? `📄${n.evidenceCount}` : ""}{(n.up > 0 || n.down > 0) ? `  👍${n.up}${n.down ? ` 👎${n.down}` : ""}` : ""}</text>
      {questions > 0 && <g className="qbadge"><circle cx={n.x + n.w - 2} cy={n.y + 2} r={10} /><text x={n.x + n.w - 2} y={n.y + 6} textAnchor="middle">{questions}</text><title>{`${questions} open question${questions === 1 ? "" : "s"} touch this step`}</title></g>}
      {(n.kind === "start" || n.kind === "end") && <text x={cx} y={n.y - 5} textAnchor="middle" className="votes" style={{ fontWeight: 700, letterSpacing: ".08em" }}>{n.kind.toUpperCase()}</text>}
      <title>{n.label}</title>
    </g>
  );
  return n.sub ? <Link href={`/map/${n.sub}`}>{body}</Link> : body;
}
