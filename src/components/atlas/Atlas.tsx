"use client";
// The atlas: the whole map as nested circles on a canvas you can zoom into. The six great cycles are continents;
// inside each, its subprocesses; inside those, the steps as dots. Lines between processes are drawn as bands whose
// width is how many lines cross; listed open questions are purple threads between the steps they join. Scroll or
// pinch to zoom, drag to pan, click a circle to fly into it, click outside to fly back out.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { hierarchy, pack, type HierarchyCircularNode } from "d3-hierarchy";

export type AtlasNode = { id: string; t: string; k: "p" | "s"; d?: string; e?: number; f?: 1; n?: AtlasNode[] };
export type AtlasData = { root: AtlasNode; links: { a: string; b: string; n: number }[]; questions: { id: string; a: string; b: string; t: string }[]; counts: { processes: number; steps: number } };
type N = HierarchyCircularNode<AtlasNode>;

const SIZE = 2400;
const PALETTE = ["#f6b73c", "#4fb3ff", "#4fd58a", "#c48bff", "#e0865a", "#3fd2c7", "#ff7aa8", "#9fd4ff"];
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const ell = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export default function Atlas({ data }: { data: AtlasData }) {
  const host = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [focus, setFocus] = useState<string>(data.root.id);
  const [sel, setSel] = useState<N | null>(null);
  const [q, setQ] = useState("");
  const api = useRef<{ zoomTo: (n: N) => void } | null>(null);

  const layout = useMemo(() => {
    const h = hierarchy<AtlasNode>(data.root, d => d.n).sum(d => (d.k === "s" ? 1 : 0));
    const root = pack<AtlasNode>().size([SIZE, SIZE]).padding(d => (d.children ? Math.max(3, 14 - d.depth * 2) : 1.6))(h);
    const byId = new Map<string, N>(); root.each(n => byId.set(n.data.id, n));
    const branchOf = (n: N) => { let c = n; while (c.depth > 1 && c.parent) c = c.parent; return c; };
    const colorOf = new Map<string, string>(); const top = root.children || [];
    root.each(n => { const b = branchOf(n); const i = Math.max(0, top.indexOf(b)); colorOf.set(n.data.id, n.depth === 0 ? "#6f88a8" : PALETTE[i % PALETTE.length]); });
    return { root, byId, colorOf };
  }, [data]);
  const crumbs = useMemo(() => { const n = layout.byId.get(focus); if (!n) return []; return n.ancestors().reverse(); }, [focus, layout]);
  const hits = useMemo(() => { const t = q.trim().toLowerCase(); if (t.length < 2) return []; const out: N[] = []; layout.root.each(n => { if (n.data.t && n.data.t.toLowerCase().includes(t)) out.push(n); }); return out.sort((a, b) => a.depth - b.depth || (b.r - a.r)).slice(0, 12); }, [q, layout]);

  useEffect(() => {
    const el = host.current, canvas = canvasRef.current; if (!el || !canvas) return;
    const ctx = canvas.getContext("2d")!; const { root, byId, colorOf } = layout;
    let W = el.clientWidth, H = el.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => { W = el.clientWidth; H = el.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + "px"; canvas.style.height = H + "px"; dirty = true; };
    // view transform: screen = world * k + (x, y)
    const fit = (n: N) => { const k = (0.86 * Math.min(W, H)) / (2 * n.r); return { k, x: W / 2 - n.x * k, y: H / 2 - n.y * k }; };
    resize(); let view = fit(root); let anim: { from: typeof view; to: typeof view; t0: number; dur: number } | null = null; let dirty = true;
    let hover: N | null = null; let hoverPt = { x: 0, y: 0 }; let focusNode: N = root;
    const nodes: N[] = []; root.each(n => nodes.push(n));
    const leafPos = new Map<string, N>(); root.leaves().forEach(l => leafPos.set(l.data.id, l));
    const deepest = (sx: number, sy: number): N | null => { const wx = (sx - view.x) / view.k, wy = (sy - view.y) / view.k; let cur: N | null = null; let n: N | undefined = root; while (n) { const dx = wx - n.x, dy = wy - n.y; if (dx * dx + dy * dy > n.r * n.r) break; cur = n; const kids: N[] = n.children || []; n = kids.find(c => { const ex = wx - c.x, ey = wy - c.y; return ex * ex + ey * ey <= c.r * c.r; }); } return cur; };
    const zoomTo = (n: N) => { anim = { from: { ...view }, to: fit(n), t0: performance.now(), dur: 750 }; focusNode = n.data.k === "p" ? n : (n.parent || root); setFocus(focusNode.data.id); dirty = true; };
    api.current = { zoomTo };
    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.8); g.addColorStop(0, "#0d1626"); g.addColorStop(1, "#05080f"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const sx = (x: number) => x * view.k + view.x, sy = (y: number) => y * view.k + view.y;
      // circles, parents first
      for (const n of nodes) {
        const r = n.r * view.k; if (r < 1.2) continue; const cx = sx(n.x), cy = sy(n.y); if (cx + r < 0 || cy + r < 0 || cx - r > W || cy - r > H) continue;
        const col = colorOf.get(n.data.id) || "#fff"; const isP = n.data.k === "p";
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        if (isP) { ctx.fillStyle = col + (n.depth === 0 ? "14" : n.depth === 1 ? "22" : "1c"); ctx.fill(); ctx.lineWidth = n === focusNode ? 2 : 1; ctx.strokeStyle = col + (n === focusNode ? "cc" : "66"); ctx.stroke(); }
        else { ctx.fillStyle = n.data.f ? "#ffd27f" : "#dfe9ff"; ctx.globalAlpha = Math.min(1, r / 6) * (n === sel ? 1 : 0.85); ctx.fill(); ctx.globalAlpha = 1; if (n === sel || n === hover) { ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke(); } }
      }
      // bands between processes: width by how many lines cross
      ctx.lineCap = "round";
      for (const l of data.links) { const a = byId.get(l.a), b = byId.get(l.b); if (!a || !b) continue; const ra = a.r * view.k, rb = b.r * view.k; if (ra < 5 || rb < 5) continue; if (ra > Math.max(W, H) || rb > Math.max(W, H)) continue; const ax = sx(a.x), ay = sy(a.y), bx = sx(b.x), by = sy(b.y); const mx = (ax + bx) / 2 + (by - ay) * 0.12, my = (ay + by) / 2 - (bx - ax) * 0.12; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.lineWidth = Math.min(10, 0.8 + Math.log2(l.n + 1) * 1.1); ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.stroke(); }
      // open questions: purple threads between the steps they join
      for (const qn of data.questions) { const a = leafPos.get(qn.a) || byId.get(qn.a), b = leafPos.get(qn.b) || byId.get(qn.b); if (!a || !b) continue; const ax = sx(a.x), ay = sy(a.y), bx = sx(b.x), by = sy(b.y); if (Math.max(ax, bx) < 0 || Math.min(ax, bx) > W || Math.max(ay, by) < 0 || Math.min(ay, by) > H) continue; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2 + (by - ay) * 0.2, (ay + by) / 2 - (bx - ax) * 0.2, bx, by); ctx.setLineDash([4, 5]); ctx.lineWidth = 1.4; ctx.strokeStyle = "rgba(190,140,255,0.75)"; ctx.stroke(); ctx.setLineDash([]); }
      // labels: processes whose circle is big enough, steps when close
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (const n of nodes) {
        const r = n.r * view.k; const cx = sx(n.x), cy = sy(n.y); if (cx + r < 0 || cy + r < 0 || cx - r > W || cy - r > H) continue;
        if (n.data.k === "p") { if (r < 26 || n.depth === 0 || (n.depth > focusNode.depth + 3)) continue; const fs = Math.max(11, Math.min(26, r * 0.16)); ctx.font = `700 ${fs}px "Public Sans", system-ui, sans-serif`; const label = ell(n.data.t, Math.max(10, Math.round(r * 2 / (fs * 0.55)))); const y = r > 90 ? cy - r + fs * 1.2 : cy; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(5,8,15,0.8)"; ctx.strokeText(label, cx, y); ctx.fillStyle = "#ffffff"; ctx.fillText(label, cx, y); }
        else if (r > 14 && n.data.t) { const fs = Math.max(10, Math.min(14, r * 0.5)); ctx.font = `500 ${fs}px "Public Sans", system-ui, sans-serif`; const label = ell(n.data.t, 36); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(5,8,15,0.85)"; ctx.strokeText(label, cx, cy + r + fs * 0.8); ctx.fillStyle = "rgba(235,242,255,0.95)"; ctx.fillText(label, cx, cy + r + fs * 0.8); }
      }
      // hover tooltip
      if (hover && hover.data.t && hover.r * view.k <= (hover.data.k === "p" ? 26 : 14)) { ctx.font = `600 13px "Public Sans", system-ui, sans-serif`; const label = ell(hover.data.t, 60); const w = ctx.measureText(label).width + 16; const x = Math.min(W - w - 8, Math.max(8, hoverPt.x + 14)), y = Math.max(28, hoverPt.y - 18); ctx.fillStyle = "rgba(10,16,28,0.92)"; ctx.beginPath(); ctx.roundRect(x, y - 13, w, 26, 8); ctx.fill(); ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.fillText(label, x + 8, y); ctx.textAlign = "center"; }
    };
    let raf = 0;
    const tick = () => { raf = requestAnimationFrame(tick); if (anim) { const u = Math.min(1, (performance.now() - anim.t0) / anim.dur); const e = ease(u); view = { k: anim.from.k + (anim.to.k - anim.from.k) * e, x: anim.from.x + (anim.to.x - anim.from.x) * e, y: anim.from.y + (anim.to.y - anim.from.y) * e }; if (u >= 1) anim = null; dirty = true; } if (dirty) { draw(); dirty = false; } };
    tick();
    // input: wheel zoom about the cursor, drag to pan, pinch on touch, click to fly in or out
    const onWheel = (e: WheelEvent) => { e.preventDefault(); anim = null; const f = Math.exp(-e.deltaY * 0.0015); const nk = Math.max(fit(root).k * 0.6, Math.min(fit(root).k * 900, view.k * f)); const r = nk / view.k; const rect = canvas.getBoundingClientRect(); const px = e.clientX - rect.left, py = e.clientY - rect.top; view = { k: nk, x: px - (px - view.x) * r, y: py - (py - view.y) * r }; dirty = true; };
    const ptrs = new Map<number, { x: number; y: number }>(); let drag: { x: number; y: number; vx: number; vy: number } | null = null; let moved = 0; let pinch: { d: number; k: number; cx: number; cy: number } | null = null;
    const onDown = (e: PointerEvent) => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; drag = null; } };
    const onMove = (e: PointerEvent) => { const rect = canvas.getBoundingClientRect(); hoverPt = { x: e.clientX - rect.left, y: e.clientY - rect.top }; if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const nk = pinch.k * (d / pinch.d); const r = nk / view.k; const px = pinch.cx - rect.left, py = pinch.cy - rect.top; view = { k: nk, x: px - (px - view.x) * r, y: py - (py - view.y) * r }; dirty = true; return; } if (drag) { anim = null; moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y); view = { ...view, x: drag.vx + (e.clientX - drag.x), y: drag.vy + (e.clientY - drag.y) }; dirty = true; return; } const h = deepest(hoverPt.x, hoverPt.y); if (h !== hover) { hover = h; dirty = true; } canvas.style.cursor = h && h !== root ? "pointer" : "grab"; };
    const onUp = (e: PointerEvent) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!drag) return; const wasDrag = moved > 6; drag = null; if (wasDrag) return; const rect = canvas.getBoundingClientRect(); const n = deepest(e.clientX - rect.left, e.clientY - rect.top); if (!n || n === root) { const up = focusNode.parent || root; setSel(null); zoomTo(up); return; } if (n.data.k === "s") { setSel(n); dirty = true; const p = n.parent || root; if (p !== focusNode) zoomTo(p); return; } setSel(null); if (n === focusNode) { zoomTo(n.parent || root); } else zoomTo(n); };
    canvas.addEventListener("wheel", onWheel, { passive: false }); canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove); canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); canvas.removeEventListener("wheel", onWheel); canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp); window.removeEventListener("resize", resize); api.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  const focusNode = layout.byId.get(focus);
  const kids = focusNode?.children?.filter(c => c.data.k === "p") || [];
  const stepsIn = focusNode ? focusNode.leaves().filter(l => l.data.t).length : 0;
  return (
    <div className="at" ref={host}>
      <canvas ref={canvasRef} className="at-canvas" />
      <div className="at-top">
        <nav className="at-crumbs" aria-label="Where you are">{crumbs.map((c, i) => <span key={c.data.id}>{i > 0 && <span className="sep">›</span>}<button className="asbtn" onClick={() => api.current?.zoomTo(c)}>{c.depth === 0 ? "Earth's Systems" : c.data.t}</button></span>)}</nav>
        <div className="at-search"><input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a process or step…" aria-label="Find" />
          {hits.length > 0 && <div className="at-hits">{hits.map(h => <button key={h.data.id} onClick={() => { setQ(""); if (h.data.k === "s") { setSel(h); api.current?.zoomTo(h.parent || h); } else api.current?.zoomTo(h); }}><span>{ell(h.data.t, 70)}</span><span className="muted">{h.data.k === "p" ? "process" : "step"}</span></button>)}</div>}
        </div>
      </div>
      <aside className="at-panel">
        {sel ? (
          <>
            <button className="x" onClick={() => setSel(null)} aria-label="Close">×</button>
            <div className="at-kicker">{sel.data.f ? "Decision fork" : "Step"} · {sel.parent?.data.t}</div>
            <h2>{sel.data.t}</h2>
            <p className="small muted">{sel.data.e || 0} source{sel.data.e === 1 ? "" : "s"}</p>
            <Link className="btn primary" href={`/map/${sel.parent?.data.id}#${sel.data.id}`}>Open in the explorer →</Link>
          </>
        ) : focusNode && (
          <>
            <div className="at-kicker">{focusNode.depth === 0 ? "The whole map" : `Inside ${focusNode.parent?.data.t || ""}`}</div>
            <h2>{focusNode.depth === 0 ? "Earth's Systems" : focusNode.data.t}</h2>
            {focusNode.data.d && <p className="small muted">{focusNode.data.d}</p>}
            <p className="small muted">{focusNode.depth === 0 ? `${data.counts.processes} processes, ${data.counts.steps} steps.` : `${stepsIn} steps inside${kids.length ? `, ${kids.length} subprocess${kids.length === 1 ? "" : "es"}` : ""}.`}</p>
            {kids.length > 0 && <ul className="at-kids">{kids.map(k => <li key={k.data.id}><button className="asbtn link" onClick={() => api.current?.zoomTo(k)}>{k.data.t}</button></li>)}</ul>}
            {focusNode.depth > 0 && <Link className="btn" href={`/map/${focusNode.data.id}`}>Open in the explorer →</Link>}
            <p className="small muted at-hint">Scroll or pinch to zoom, drag to pan. Click a circle to fly into it, click outside to fly out. Dotted purple threads are open questions nobody has tested.</p>
          </>
        )}
      </aside>
    </div>
  );
}
