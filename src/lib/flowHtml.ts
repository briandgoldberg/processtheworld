// Draws a process as the same swim-lane flow the app shows: People lanes on
// top, Technology lanes below, steps flowing left to right, one diagram per
// layer. The result is one self-contained HTML file (inline SVG, no scripts).
// The layout matches layout() in src/studio/studio.js.

type Lane = { id: string; name: string; type?: string };
type Next = { to: string; label?: string; map?: string };
type Step = { id: string; lane: string; label: string; kind?: string; uses?: string[]; next?: Next[]; child?: string; link?: { id: string; title?: string; scope?: string } };
type MapT = { id: string; title?: string; parent?: { map: string; step: string } | null; lanes: Lane[]; steps: Step[] };
type Doc = { title?: string; maps: Record<string, MapT> };

const L = { HEAD: 150, COL: 196, BOXW: 158, BOXH: 60, ROWGAP: 16, PADX: 28, PADY: 16, BAND: 22 };
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

function wrap(text: string, max: number, lines: number): string[] {
  const words = clean(text).split(" "), out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1].replace(/.{0,2}$/, "") + "…"; }
  return out;
}

/**
 * Which column each step sits in. Arrows that loop back (a retry, a "no, revise")
 * are ignored, so a loop never drags its steps to the start: columns follow the
 * forward flow. Shared by the app and the exported flow.
 */
export function columnsOf(m: { steps: { id: string; next?: { to: string; map?: string }[] }[] }, internal: (n: { to: string; map?: string }) => boolean = n => !n.map): Record<string, number> {
  const ids = new Set(m.steps.map(s => s.id));
  const out: Record<string, string[]> = {};
  const hasPred = new Set<string>();
  m.steps.forEach(s => {
    out[s.id] = (s.next || []).filter(n => internal(n) && ids.has(n.to)).map(n => n.to);
    out[s.id].forEach(t => hasPred.add(t));
  });
  const back = new Set<string>(), state: Record<string, number> = {};
  const dfs = (id: string) => {
    state[id] = 1;
    for (const t of out[id]) { if (state[t] === 1) back.add(id + ">" + t); else if (!state[t]) dfs(t); }
    state[id] = 2;
  };
  m.steps.filter(s => !hasPred.has(s.id)).forEach(s => { if (!state[s.id]) dfs(s.id); });
  m.steps.forEach(s => { if (!state[s.id]) dfs(s.id); });
  const preds: Record<string, string[]> = {};
  m.steps.forEach(s => (preds[s.id] = []));
  m.steps.forEach(s => out[s.id].forEach(t => { if (!back.has(s.id + ">" + t)) preds[t].push(s.id); }));
  const col: Record<string, number> = {};
  const depth = (id: string): number => (id in col ? col[id] : (col[id] = preds[id].reduce((d, p) => Math.max(d, depth(p) + 1), 0)));
  m.steps.forEach(s => depth(s.id));
  return col;
}

function layout(m: MapT) {
  const col = columnsOf(m);
  const laneIds = new Set(m.lanes.map(l => l.id));
  const lanes: Lane[] = [...m.lanes.filter(l => l.type !== "system"), ...m.lanes.filter(l => l.type === "system")];
  if (m.steps.some(s => !laneIds.has(s.lane))) lanes.push({ id: "__none", name: "Unassigned", type: "person" });
  const laneOf = (s: Step) => (laneIds.has(s.lane) ? s.lane : "__none");
  const slot: Record<string, number> = {}, rowOf: Record<string, number> = {}, rows: Record<string, number> = {};
  m.steps.forEach(s => {
    const k = laneOf(s) + "|" + col[s.id];
    rowOf[s.id] = slot[k] = (slot[k] ?? -1) + 1;
    rows[laneOf(s)] = Math.max(rows[laneOf(s)] || 1, rowOf[s.id] + 1);
  });
  const maxCol = Math.max(0, ...Object.values(col));
  const width = L.HEAD + L.PADX * 2 + (maxCol + 1) * L.COL;
  const firstSys = lanes.findIndex(l => l.type === "system");
  let y = 0;
  const laneY: Record<string, number> = {}, laneH: Record<string, number> = {}, bands: { y: number; t: string }[] = [];
  lanes.forEach((l, i) => {
    if (i === 0 && l.type !== "system") { bands.push({ y, t: "People" }); y += L.BAND; }
    if (i === firstSys) { bands.push({ y, t: "Technology" }); y += L.BAND; }
    laneY[l.id] = y;
    laneH[l.id] = (rows[l.id] || 1) * (L.BOXH + L.ROWGAP) + L.PADY * 2 - L.ROWGAP + 8;
    y += laneH[l.id];
  });
  const pos: Record<string, { x: number; y: number }> = {};
  m.steps.forEach(s => { pos[s.id] = { x: L.HEAD + L.PADX + col[s.id] * L.COL, y: laneY[laneOf(s)] + L.PADY + rowOf[s.id] * (L.BOXH + L.ROWGAP) }; });
  return { lanes, laneY, laneH, bands, pos, width, height: y, col, laneOf };
}

function svgFor(m: MapT, doc: Doc): string {
  const g = layout(m);
  const laneById = new Map(m.lanes.map(l => [l.id, l]));
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.width} ${Math.max(g.height, 80) + 8}" width="${g.width}" height="${Math.max(g.height, 80) + 8}" role="img" aria-label="${esc(clean(m.title))}">`);
  out.push(`<defs>${(["", "yes", "no"] as const).map(t => `<marker id="ah${t}-${esc(m.id)}" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M1 1L11 6L1 11L3.5 6z" class="ah ${t}"/></marker>`).join("")}</defs>`);
  g.bands.forEach(b => out.push(`<text x="12" y="${b.y + 15}" class="band">${b.t.toUpperCase()}</text>`));
  g.lanes.forEach(l => {
    const sys = l.type === "system";
    out.push(`<rect x="0" y="${g.laneY[l.id]}" width="${g.width}" height="${g.laneH[l.id]}" class="lane ${sys ? "sys" : "per"}"/>`);
    wrap(l.name, 16, 3).forEach((t, i, a) => out.push(`<text x="12" y="${g.laneY[l.id] + g.laneH[l.id] / 2 + (i - (a.length - 1) / 2) * 15 + 4}" class="lanename ${sys ? "sys" : "per"}">${esc(t)}</text>`));
  });
  // edges first so boxes sit on top
  const edgeLabels: string[] = [];
  for (const s of m.steps) {
    const a = g.pos[s.id];
    for (const n of s.next || []) {
      if (n.map || !g.pos[n.to]) continue;
      const b = g.pos[n.to];
      let d: string, lx: number, ly: number;
      if (g.col[n.to] > g.col[s.id]) {
        const x1 = a.x + L.BOXW, y1 = a.y + L.BOXH / 2, x2 = b.x, y2 = b.y + L.BOXH / 2, mx = (x1 + x2) / 2;
        d = `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`; lx = mx; ly = (y1 + y2) / 2;
      } else {
        const x1 = a.x + L.BOXW / 2, y1 = a.y + L.BOXH, x2 = b.x + L.BOXW / 2, y2 = b.y + L.BOXH, dy = 34;
        d = `M${x1} ${y1} C${x1} ${y1 + dy} ${x2} ${y2 + dy} ${x2} ${y2}`; lx = (x1 + x2) / 2; ly = Math.max(y1, y2) + dy * 0.75;
      }
      const lab = clean(n.label), tone = /^(yes|y|ok|okay|approved?|pass(ed)?|true|done|found|clear(ed)?|success|accept(ed)?|signed|match(es)?|resolved|enough|ready)\b/i.test(lab) ? "yes" : /^(no|n|not|fail(ed)?|reject(ed)?|denied|false|retry|missing|wait|too|stuck|nothing|blocked|cancel(led)?)\b/i.test(lab) ? "no" : "";
      out.push(`<path d="${d}" class="edge ${tone}${g.col[n.to] <= g.col[s.id] ? " back" : ""}" marker-end="url(#ah${tone}-${esc(m.id)})"/>`);
      if (lab) {
        const t = (tone === "yes" ? "✓ " : tone === "no" ? "✕ " : "") + lab.slice(0, 22), w = t.length * 6.6 + 14;
        edgeLabels.push(`<rect x="${lx - w / 2}" y="${ly - 10}" width="${w}" height="19" rx="9.5" class="elbg ${tone}"/><text x="${lx}" y="${ly + 3.5}" class="el ${tone}" text-anchor="middle">${esc(t)}</text>`);
      }
    }
  }
  for (const s of m.steps) {
    const p = g.pos[s.id], lane = laneById.get(s.lane);
    const sys = lane?.type === "system", kind = s.kind || "task";
    const cls = `node ${sys ? "sys" : "per"} ${kind}`;
    const rx = kind === "start" || kind === "end" ? L.BOXH / 2 : 10;
    const cx = p.x + L.BOXW / 2;
    const uses = (s.uses || []).map(u => clean(laneById.get(u)?.name)).filter(Boolean);
    const lines = wrap(s.label, 22, uses.length ? 2 : 3);
    const total = lines.length + (uses.length ? 0.8 : 0);
    let y0 = p.y + L.BOXH / 2 - (total * 14) / 2 + 11;
    let shape: string;
    if (kind === "decision") {
      const c = 14;
      shape = `<polygon class="${cls}" points="${p.x + c},${p.y} ${p.x + L.BOXW - c},${p.y} ${p.x + L.BOXW},${p.y + L.BOXH / 2} ${p.x + L.BOXW - c},${p.y + L.BOXH} ${p.x + c},${p.y + L.BOXH} ${p.x},${p.y + L.BOXH / 2}"/>`;
    } else shape = `<rect class="${cls}" x="${p.x}" y="${p.y}" width="${L.BOXW}" height="${L.BOXH}" rx="${rx}"/>`;
    let txt = lines.map((t, i) => `<text x="${cx}" y="${y0 + i * 14}" class="nt" text-anchor="middle">${esc(t)}</text>`).join("");
    if (uses.length) txt += `<text x="${cx}" y="${y0 + lines.length * 14 + 2}" class="nu" text-anchor="middle">${esc(wrap("uses " + uses.join(", "), 28, 1)[0])}</text>`;
    const jump = (s.next || []).filter(n => n.map && doc.maps[n.map]).map(n => `<text x="${cx}" y="${p.y + L.BOXH + 12}" class="nu" text-anchor="middle">→ ${esc(wrap(clean(doc.maps[n.map!].title) || n.map!, 24, 1)[0])}</text>`).join("");
    let node = shape + txt + jump;
    if (s.link) node = `<a ${s.link.scope === "private" ? "" : `href="https://processtheworld.vercel.app/p/${esc(s.link.id)}" target="_blank" rel="noopener"`}>${shape}${txt}<text x="${p.x + L.BOXW - 8}" y="${p.y + 14}" class="drill" text-anchor="end">↗</text><title>Opens the process “${esc(clean(s.link.title))}”</title></a>`;
    if (s.child && doc.maps[s.child]) node = `<a href="#${esc(s.child)}">${shape}${txt}<text x="${p.x + L.BOXW - 8}" y="${p.y + 14}" class="drill" text-anchor="end">↘</text></a>`;
    out.push(`<g>${node}</g>`);
  }
  out.push(edgeLabels.join(""));
  out.push("</svg>");
  return out.join("");
}

const CSS = `
:root{--edge:#2F3B4C;--ok:#1E7B47;--no:#C2410C;--bg:#F3F5F8;--surface:#fff;--ink:#141C27;--muted:#5A6573;--line:#D7DDE5;--accent:#2448C9;--person:#A86A12;--person-bg:#FBF3E6;--system:#0D7672;--system-bg:#E5F3F2}
@media (prefers-color-scheme:dark){:root{--edge:#AEBBCD;--ok:#5BD08F;--no:#FF9A6B;--bg:#0F141B;--surface:#171E28;--ink:#E7ECF2;--muted:#98A3B2;--line:#2C3746;--accent:#7C9BFF;--person:#E3A548;--person-bg:#2A2216;--system:#4CC2BC;--system-bg:#14292A}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1200px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:28px;margin:0 0 4px}h2{font-size:18px;margin:32px 0 8px}h2 small{font-weight:400;color:var(--muted);font-size:13px;margin-left:8px}
p.sub{color:var(--muted);margin:0 0 8px}a{color:var(--accent)}
.board{overflow:auto;background:var(--surface);border:1px solid var(--line);border-radius:12px}
svg{display:block}svg text{font-family:inherit}
.lane.per{fill:var(--person-bg)}.lane.sys{fill:var(--system-bg)}.lane{stroke:var(--line)}
.band{font-size:10px;letter-spacing:.08em;font-weight:700;fill:var(--muted)}
.lanename{font-size:12px;font-weight:700}.lanename.per{fill:var(--person)}.lanename.sys{fill:var(--system)}
.edge{fill:none;stroke:var(--edge);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}.edge.yes{stroke:var(--ok)}.edge.no{stroke:var(--no)}.edge.back{stroke-dasharray:7 5}.ah{fill:var(--edge)}.ah.yes{fill:var(--ok)}.ah.no{fill:var(--no)}
.node{fill:var(--surface);stroke-width:1.5}.node.per{stroke:var(--person)}.node.sys{stroke:var(--system)}
.node.start,.node.end{stroke-width:2.5}.node.decision{stroke-dasharray:none;fill:var(--surface)}.node.subprocess{stroke-width:2.5}
.nt{font-size:12px;font-weight:600;fill:var(--ink)}.nu{font-size:10px;fill:var(--muted)}.drill{font-size:14px;font-weight:700;fill:var(--accent)}
.elbg{fill:var(--surface);stroke:var(--edge);stroke-width:1.5}.elbg.yes{stroke:var(--ok)}.elbg.no{stroke:var(--no)}.el{font-size:11px;font-weight:700;fill:var(--ink)}.el.yes{fill:var(--ok)}.el.no{fill:var(--no)}
.node{stroke-width:1.6}.node.start{fill:color-mix(in srgb,var(--ok) 12%,var(--surface));stroke:var(--ok)}.node.end{fill:color-mix(in srgb,var(--accent) 10%,var(--surface));stroke:var(--accent)}.node.decision{fill:color-mix(in srgb,#E8A317 14%,var(--surface));stroke:#E8A317}
.bar{display:flex;gap:8px;align-items:center;margin:8px 0}.bar button{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:8px;padding:6px 12px;font:inherit;font-weight:600;cursor:pointer}
.board{cursor:grab}.board.panning{cursor:grabbing;user-select:none}.fsmode{position:fixed;inset:0;background:var(--bg);overflow:auto;z-index:9;padding:16px}
footer{margin-top:32px;color:var(--muted);font-size:12px}
`;

export function flowHtml(doc: Doc, opts: { author?: string; url?: string } = {}): string {
  const maps = doc.maps || {};
  const root = maps.m_root || Object.values(maps)[0];
  const title = clean(doc.title || root?.title) || "Process";
  const all = Object.values(maps);
  const order = [root, ...all.filter(m => m !== root)].filter(Boolean);
  const steps = all.reduce((n, m) => n + m.steps.length, 0);
  const sections = order.map(m => {
    const parent = m.parent ? maps[m.parent.map] : null;
    const pstep = parent?.steps.find(s => s.id === m.parent!.step);
    const head = m === root ? esc(title) : esc(clean(m.title) || m.id);
    const sub = parent ? `<small>detail of “${esc(clean(pstep?.label))}” · <a href="#${esc(parent.id)}">back</a></small>` : "";
    return `<section id="${esc(m.id)}"><h2>${head} ${sub}</h2><div class="board">${svgFor(m, doc)}</div></section>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Process the World</title><style>${CSS}</style></head>
<body><main>
<h1>${esc(title)}</h1>
<p class="sub">${steps} steps across ${all.length} layer${all.length === 1 ? "" : "s"}${opts.author ? ` · by ${esc(opts.author)}` : ""}. Steps with ↘ open into a detail layer below; steps with ↗ open another published process.</p>
<div class="bar"><button id="fs">Full screen</button><button id="zo">−</button><button id="zi">+</button><span class="sub">Drag to move around. Ctrl + scroll to zoom.</span></div>
${sections}
<footer>Made with <a href="${esc(opts.url || "https://processtheworld.vercel.app")}">Process the World</a></footer>
</main>
<script>
(function(){
  var z=1,main=document.querySelector("main");
  function apply(){document.querySelectorAll("svg").forEach(function(s){s.style.zoom=z;});}
  document.getElementById("zi").onclick=function(){z=Math.min(2,z*1.25);apply();};
  document.getElementById("zo").onclick=function(){z=Math.max(.3,z/1.25);apply();};
  document.getElementById("fs").onclick=function(){if(document.fullscreenElement){document.exitFullscreen();}else if(document.documentElement.requestFullscreen){document.documentElement.requestFullscreen();}else{main.classList.toggle("fsmode");}};
  document.addEventListener("wheel",function(e){if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();z=Math.max(.3,Math.min(2,z*(e.deltaY<0?1.1:1/1.1)));apply();},{passive:false});
  document.querySelectorAll(".board").forEach(function(b){
    var p=null;
    b.addEventListener("pointerdown",function(e){if(e.target.closest("a"))return;p={x:e.clientX,y:e.clientY,l:b.scrollLeft,t:b.scrollTop};b.setPointerCapture(e.pointerId);b.classList.add("panning");});
    b.addEventListener("pointermove",function(e){if(!p)return;b.scrollLeft=p.l-(e.clientX-p.x);b.scrollTop=p.t-(e.clientY-p.y);});
    function end(){p=null;b.classList.remove("panning");}
    b.addEventListener("pointerup",end);b.addEventListener("pointercancel",end);
  });
})();
</script></body></html>`;
}
