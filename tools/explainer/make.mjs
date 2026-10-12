// Turns a public forks.world process into a narrated, animated MP4. No AI calls: the map is already
// structured, so scenes, narration, timing and the camera come from templates and plain code.
//
//   node make.mjs <publicId | https://forks.world/p/<id>> [--out video.mp4] [--voice Zira|David] [--fps 20]
//
// Needs Windows (the narration uses the built-in speech voices). Frames are drawn with resvg and
// joined with the narration by ffmpeg (both installed by `npm install` in this folder).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const require = createRequire(import.meta.url);
const { Resvg } = require("@resvg/resvg-js");
const ffmpeg = require("ffmpeg-static");
const ts = require(path.join(repo, "node_modules/typescript"));

// ---------- arguments ----------
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf("--" + name); return i >= 0 ? args[i + 1] : def; };
const target = args.find(a => !a.startsWith("--") && args[args.indexOf(a) - 1]?.startsWith("--") !== true);
if (!target) { console.log("Usage: node make.mjs <publicId | url> [--out file.mp4] [--voice Zira|David] [--fps 20]"); process.exit(1); }
const id = target.replace(/^.*\/p\//, "").replace(/[/?#].*$/, "");
const FPS = Number(opt("fps", 20)), W = 1280, H = 720;
const voice = opt("voice", "Zira");

// ---------- the app's own layout code ----------
const mod = new (await import("node:module")).default("flow"); mod.paths = [];
mod._compile(ts.transpileModule(fs.readFileSync(path.join(repo, "src/lib/flowHtml.ts"), "utf8"), { compilerOptions: { module: "commonjs", target: "es2020" } }).outputText, "flow.js");
const { layout } = mod.exports;

// ---------- the process ----------
const res = await fetch(`https://forks.world/api/public/${id}`);
if (!res.ok) { console.log("Could not load that process:", res.status); process.exit(1); }
const pub = await res.json();
const maps = pub.doc?.maps || {};
const root = maps.m_root || Object.values(maps)[0];
const title = pub.title || pub.doc?.title || "Process";
const out = path.resolve(opt("out", `${id}.mp4`));

const byId = new Map(root.steps.map(s => [s.id, s]));
const order = []; { const seen = new Set(); const visit = i => { const s = byId.get(i); if (!s || seen.has(i)) return; seen.add(i); order.push(s); (s.next || []).forEach(n => { if (!n.map) visit(n.to); }); }; root.steps.filter(s => s.kind === "start").forEach(s => visit(s.id)); root.steps.forEach(s => visit(s.id)); }
const laneName = new Map(root.lanes.map(l => [l.id, l.name]));
const clean = t => String(t ?? "").replace(/\s+/g, " ").replace(/[“”"]/g, "").trim();
const lower = t => { t = clean(t); return t.length > 1 && t[1] === t[1].toLowerCase() ? t[0].toLowerCase() + t.slice(1) : t; };
const stop = t => clean(t).replace(/[.?!:;,]+$/, "");

// ---------- scenes: one per step, narration from templates ----------
const scenes = [];
scenes.push({ kind: "intro", text: `${stop(title)}. Here is how it works, step by step.`, step: null });
const openers = ["Then", "Next", "After that", "From there"];
order.forEach((s, i) => {
  const lane = laneName.get(s.lane) || "";
  const label = stop(s.label);
  let say;
  if (s.kind === "start") say = `It starts here. ${label}.`;
  else if (s.kind === "end") say = `And that ends the process: ${lower(label)}.`;
  else if (s.kind === "decision") {
    const outs = (s.next || []).filter(n => n.label && byId.get(n.to)).slice(0, 3);
    say = `Now a decision. ${label}?` + outs.map(n => ` If ${lower(stop(n.label))}, ${(order.indexOf(byId.get(n.to)) <= i ? "go back to " : "go to ")}${lower(stop(byId.get(n.to).label))}.`).join("");
  } else if (s.kind === "subprocess" || s.link) say = `This step is a whole process of its own: ${lower(label)}.`;
  else say = `${openers[i % openers.length]}, ${lane ? stop(lane) + ": " : ""}${lower(label)}.`;
  if (s.pain?.note) say += ` Watch out: ${lower(stop(s.pain.note))}.`;
  scenes.push({ kind: "step", step: s, text: say });
});
scenes.push({ kind: "outro", text: "That is the whole process. Explore more, and make your own, at forks dot world.", step: null });

// ---------- narration: free built-in voice, one wav per scene ----------
const work = path.join(here, ".cache", id + "-" + voice); fs.mkdirSync(work, { recursive: true });
const sentences = path.join(work, "sentences.json");
const wanted = JSON.stringify(scenes.map(s => s.text));
const cached = fs.existsSync(sentences) && fs.readFileSync(sentences, "utf8") === wanted;
fs.writeFileSync(sentences, wanted);
const ps = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$v = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Name -like '*${voice}*' } | Select-Object -First 1
if ($v) { $s.SelectVoice($v.VoiceInfo.Name) }
$s.Rate = 0
$t = Get-Content -Raw -Encoding UTF8 '${sentences.replace(/\\/g, "/")}' | ConvertFrom-Json
for ($i = 0; $i -lt $t.Count; $i++) { $s.SetOutputToWaveFile(('${work.replace(/\\/g, "/")}/a_{0:D3}.wav' -f $i)); $s.Speak($t[$i]); $s.SetOutputToNull() }
`;
const sp = cached ? { status: 0 } : spawnSync("powershell.exe", ["-NoProfile", "-Command", ps], { encoding: "utf8" });
if (sp.status !== 0) { console.log("Narration failed:", sp.stderr || sp.stdout); process.exit(1); }

function readWav(file) {
  const b = fs.readFileSync(file);
  let p = 12, fmt = null, data = null;
  while (p + 8 <= b.length) {
    const tag = b.toString("ascii", p, p + 4), size = b.readUInt32LE(p + 4);
    if (tag === "fmt ") fmt = { ch: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), byteRate: b.readUInt32LE(p + 16), bits: b.readUInt16LE(p + 22) };
    if (tag === "data") { data = b.subarray(p + 8, p + 8 + Math.min(size, b.length - p - 8)); break; }
    p += 8 + size + (size % 2);
  }
  return { fmt, data };
}
const wavs = scenes.map((_, i) => readWav(path.join(work, `a_${String(i).padStart(3, "0")}.wav`)));
const fmt = wavs[0].fmt, PAD = 0.75;
scenes.forEach((s, i) => { s.audio = wavs[i].data.length / fmt.byteRate; s.dur = s.audio + PAD + (s.kind === "intro" ? 0.6 : 0); });
let t0 = 0; scenes.forEach(s => { s.t0 = t0; t0 += s.dur; });
const total = t0;

// one audio track: each narration, then a pause
{
  const parts = [];
  scenes.forEach((s, i) => {
    parts.push(wavs[i].data);
    const padBytes = Math.round((s.dur - s.audio) * fmt.byteRate); parts.push(Buffer.alloc(padBytes - (padBytes % (fmt.ch * fmt.bits / 8))));
  });
  const pcm = Buffer.concat(parts), h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(fmt.ch, 22);
  h.writeUInt32LE(fmt.rate, 24); h.writeUInt32LE(fmt.byteRate, 28); h.writeUInt16LE(fmt.ch * fmt.bits / 8, 32); h.writeUInt16LE(fmt.bits, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(path.join(work, "audio.wav"), Buffer.concat([h, pcm]));
}

// ---------- drawing ----------
const g = layout(root);
const BW = 158, BH = 60, VIEWW = 760;
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const wrap = (text, max, lines) => {
  const words = clean(text).split(" "), out = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) out.push(cur);
  if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1].replace(/.{0,2}$/, "") + "…"; }
  return out;
};
const laneType = new Map(root.lanes.map(l => [l.id, l.type]));
const KIND = { start: ["#DDF3E4", "#1E7B47"], end: ["#E1E8FB", "#2448C9"], decision: ["#FDF0D5", "#C98A0A"], subprocess: ["#EFE7FA", "#6B3FC0"] };
const stepIndex = new Map(order.map((s, i) => [s.id, i]));
const center = s => { const p = g.pos[s.id]; return { x: p.x + BW / 2, y: p.y + BH / 2 }; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = x => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

function camFor(i) {
  const sc = scenes[i];
  if (!sc.step) return { cx: g.width / 2, cy: g.height / 2, fit: true };
  const c = center(sc.step);
  return { cx: c.x, cy: c.y };
}
const scale = Math.min(W / VIEWW, 1.9);
const viewH = H / scale;
function camera(i, local) {
  const cur = camFor(i), prev = i > 0 ? camFor(i - 1) : cur;
  const k = ease(clamp(local / 0.9, 0, 1));
  let cx = prev.cx + (cur.cx - prev.cx) * k, cy = prev.cy + (cur.cy - prev.cy) * k;
  const fitScale = Math.min(W / g.width, (H - 200) / g.height);
  let s = scale;
  if (g.width <= VIEWW) { s = Math.min(fitScale, 1.9); cx = g.width / 2; }
  const vw = W / s, vh = H / s;
  cx = g.width <= vw ? g.width / 2 : clamp(cx, vw / 2, g.width - vw / 2);
  cy = g.height <= vh - 140 / s ? g.height / 2 : clamp(cy, vh / 2 - 40 / s, g.height - vh / 2 + 120 / s);
  return { s, tx: W / 2 - cx * s, ty: (H - 150) / 2 + 20 - cy * s };
}

function stepSvg(s, state, pop) {
  const p = g.pos[s.id], [fill, stroke0] = KIND[s.kind] || ["#FFFFFF", laneType.get(s.lane) === "system" ? "#0D7672" : "#8A93A6"];
  const cur = state === "current", dim = state === "future";
  const stroke = cur ? "#2448C9" : stroke0, sw = cur ? 3.5 : 1.6;
  const sx = cur ? 1 + 0.07 * pop : 1, cx = p.x + BW / 2, cy = p.y + BH / 2;
  const r = s.kind === "start" || s.kind === "end" ? BH / 2 : s.kind === "decision" ? 14 : 9;
  const lines = wrap(s.label, 22, 3), lh = 15.5, y0 = cy - (lines.length - 1) * lh / 2 + 5;
  let out = `<g transform="translate(${cx} ${cy}) scale(${sx}) translate(${-cx} ${-cy})">`;
  if (cur) out += `<rect x="${p.x - 6}" y="${p.y - 6}" width="${BW + 12}" height="${BH + 12}" rx="${r + 4}" fill="#2448C9" opacity="0.14"/>`;
  out += `<rect x="${p.x}" y="${p.y}" width="${BW}" height="${BH}" rx="${r}" fill="${dim ? "#F1F3F8" : fill}" stroke="${dim ? "#D3D9E4" : stroke}" stroke-width="${sw}"/>`;
  lines.forEach((l, i) => { out += `<text x="${cx}" y="${y0 + i * lh}" font-size="13" font-weight="${cur ? 700 : 600}" text-anchor="middle" fill="${dim ? "#A5ADBF" : "#1A2233"}" font-family="Segoe UI, Arial, sans-serif">${esc(l)}</text>`; });
  if (s.pain && state !== "future") out += `<circle cx="${p.x + BW - 2}" cy="${p.y + 2}" r="11" fill="${s.pain.level >= 3 ? "#D6322C" : "#E8A317"}"/><text x="${p.x + BW - 2}" y="${p.y + 6.5}" font-size="13" font-weight="800" text-anchor="middle" fill="#fff" font-family="Segoe UI, Arial, sans-serif">!</text>`;
  return out + "</g>";
}

function edgeSvg(a, n, shown) {
  const b = byId.get(n.to); if (!b || n.map || !g.pos[b.id]) return "";
  const pa = g.pos[a.id], pb = g.pos[b.id], ay = pa.y + BH / 2, by = pb.y + BH / 2;
  let d, lx, ly, ax, ay2, dir;
  if (pb.x > pa.x) { const sx = pa.x + BW, mid = sx + (pb.x - sx) / 2; d = `M${sx},${ay} H${mid} V${by} H${pb.x - 3}`; lx = sx + 6; ly = ay - 6; ax = pb.x - 3; ay2 = by; dir = [1, 0]; }
  else if (pb.x === pa.x) { const sx = pa.x + BW / 2; if (pb.y > pa.y) { d = `M${sx},${pa.y + BH} V${pb.y - 3}`; ax = sx; ay2 = pb.y - 3; dir = [0, 1]; } else { d = `M${sx},${pa.y} V${pb.y + BH + 3}`; ax = sx; ay2 = pb.y + BH + 3; dir = [0, -1]; } lx = sx + 8; ly = (pa.y + pb.y) / 2; }
  else { const low = Math.max(pa.y, pb.y) + BH + 12; d = `M${pa.x + BW / 2},${pa.y + BH} V${low} H${pb.x + BW / 2} V${pb.y + BH + 3}`; lx = (pa.x + pb.x) / 2 + BW / 2; ly = low - 4; ax = pb.x + BW / 2; ay2 = pb.y + BH + 3; dir = [0, -1]; }
  const col = shown ? "#5B6B88" : "#C9D0DC", op = shown ? 1 : 0.35;
  const hx = dir[0], hy = dir[1];
  const tri = `${ax},${ay2} ${ax - hx * 9 - hy * 5},${ay2 - hy * 9 - hx * 5} ${ax - hx * 9 + hy * 5},${ay2 - hy * 9 + hx * 5}`;
  let out = `<path d="${d}" fill="none" stroke="${col}" stroke-width="1.8" stroke-opacity="${op}"/><polygon points="${tri}" fill="${col}" fill-opacity="${op}"/>`;
  if (n.label && shown) out += `<text x="${lx}" y="${ly}" font-size="11.5" font-weight="700" fill="#3B4660" font-family="Segoe UI, Arial, sans-serif">${esc(stop(n.label).slice(0, 22))}</text>`;
  return out;
}

function frameSvg(time) {
  let i = scenes.findIndex((s, k) => time < s.t0 + s.dur || k === scenes.length - 1);
  const sc = scenes[i], local = time - sc.t0;
  let body = "";
  if (sc.kind === "intro" || sc.kind === "outro") {
    const lines = wrap(sc.kind === "intro" ? title : "forks.world", 26, 4), fs0 = sc.kind === "intro" ? 62 : 80;
    body = `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1E3FB5"/><stop offset="1" stop-color="#5B2BB5"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      ${lines.map((l, k) => `<text x="${W / 2}" y="${H / 2 - (lines.length - 1) * fs0 * 0.6 + k * fs0 * 1.2}" font-size="${fs0}" font-weight="800" text-anchor="middle" fill="#fff" font-family="Segoe UI, Arial, sans-serif">${esc(l)}</text>`).join("")}
      <text x="${W / 2}" y="${H / 2 + lines.length * fs0 * 0.7 + 30}" font-size="28" text-anchor="middle" fill="#DCE3FF" font-family="Segoe UI, Arial, sans-serif">${sc.kind === "intro" ? `A process map on forks.world · ${order.length} steps` : "Mapping how the world works"}</text>`;
    const fade = clamp(local / 0.5, 0, 1); body += `<rect width="${W}" height="${H}" fill="#000" opacity="${(1 - fade) * 0.5}"/>`;
  } else {
    const cam = camera(i, local);
    const visited = new Set(order.slice(0, i - 1).map(s => s.id)), curId = sc.step.id;
    const pop = ease(clamp(local / 0.4, 0, 1));
    let world = "";
    g.bands.forEach(bd => { world += `<text x="${g.width - 8}" y="${bd.y + 14}" font-size="11" text-anchor="end" fill="#8A93A6" font-family="Segoe UI, Arial, sans-serif">${esc(bd.t.toUpperCase())}</text>`; });
    g.lanes.forEach(l => { world += `<rect x="0" y="${g.laneY[l.id]}" width="${g.width}" height="${g.laneH[l.id]}" fill="${l.type === "system" ? "#E5F3F2" : "#FBF3E6"}" opacity="0.8"/><line x1="0" y1="${g.laneY[l.id] + g.laneH[l.id]}" x2="${g.width}" y2="${g.laneY[l.id] + g.laneH[l.id]}" stroke="#D6DBE5"/>`; });
    root.steps.forEach(a => (a.next || []).forEach(n => { const b = byId.get(n.to); const shown = (visited.has(a.id) || a.id === curId) && b && (visited.has(b.id) || b.id === curId); world += edgeSvg(a, n, shown); }));
    root.steps.forEach(s => { world += stepSvg(s, s.id === curId ? "current" : visited.has(s.id) ? "past" : "future", pop); });
    let labels = "";
    g.lanes.forEach(l => { const y = cam.ty + (g.laneY[l.id] + g.laneH[l.id] / 2) * cam.s; if (y > 30 && y < H - 150) { const nm = wrap(l.name, 16, 2); labels += `<rect x="8" y="${y - 16 - (nm.length - 1) * 8}" width="150" height="${32 + (nm.length - 1) * 16}" rx="10" fill="${l.type === "system" ? "#0D7672" : "#A86A12"}" opacity="0.92"/>` + nm.map((t, k) => `<text x="83" y="${y + 5 - (nm.length - 1) * 8 + k * 16}" font-size="14" font-weight="700" text-anchor="middle" fill="#fff" font-family="Segoe UI, Arial, sans-serif">${esc(t)}</text>`).join(""); } });
    const cap = wrap(sc.text, 62, 3), capH = 40 + cap.length * 38;
    body = `<rect width="${W}" height="${H}" fill="#F6F7FB"/><g transform="translate(${cam.tx} ${cam.ty}) scale(${cam.s})">${world}</g>${labels}
      <rect x="0" y="${H - capH - 14}" width="${W}" height="${capH + 14}" fill="#0F172A" opacity="0.92"/>
      ${cap.map((l, k) => `<text x="${W / 2}" y="${H - capH + 14 + k * 38 + 22}" font-size="30" font-weight="600" text-anchor="middle" fill="#fff" font-family="Segoe UI, Arial, sans-serif">${esc(l)}</text>`).join("")}
      <text x="24" y="38" font-size="20" font-weight="700" fill="#1A2233" font-family="Segoe UI, Arial, sans-serif">${esc(stop(title).slice(0, 70))}</text>
      <text x="${W - 24}" y="38" font-size="18" font-weight="700" text-anchor="end" fill="#2448C9" font-family="Segoe UI, Arial, sans-serif">forks.world</text>`;
  }
  body += `<rect x="0" y="${H - 6}" width="${Math.max(1, W * clamp(time / total, 0, 1))}" height="6" fill="#7FA2FF"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
}

// ---------- frames (a still frame is drawn once and reused) ----------
if (process.env.DUMP) { fs.writeFileSync("dump0.svg", frameSvg(0)); fs.writeFileSync("dump1.svg", frameSvg(scenes[2].t0 + 0.5)); process.exit(0); }
const FONT = { loadSystemFonts: false, fontFiles: ["segoeui.ttf", "segoeuib.ttf", "seguisb.ttf"].map(f => "C:/Windows/Fonts/" + f).filter(f => fs.existsSync(f)), defaultFontFamily: "Segoe UI" };
const frames = path.join(work, "frames"); fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames);
const n = Math.ceil(total * FPS);
let last = null, lastKey = "";
for (let f = 0; f < n; f++) {
  const time = f / FPS, i = scenes.findIndex((s, k) => time < s.t0 + s.dur || k === scenes.length - 1), local = time - scenes[i].t0;
  const moving = scenes[i].kind === "step" && local < 1.0;
  const key = moving ? `m${f}` : `s${i}${scenes[i].kind !== "step" && local < 0.5 ? "f" + f : ""}${Math.floor(time / total * W)}`;
  const file = path.join(frames, `f${String(f).padStart(5, "0")}.png`);
  if (!moving && last && key === lastKey) { fs.copyFileSync(last, file); continue; }
  const png = new Resvg(frameSvg(time), { fitTo: { mode: "width", value: W }, font: FONT }).render().asPng();
  fs.writeFileSync(file, png); last = file; lastKey = key;
  if (f % 100 === 0) process.stdout.write(`\rframes ${f}/${n}`);
}
console.log(`\rframes ${n}/${n}   ${total.toFixed(1)} seconds`);

// ---------- encode ----------
const enc = spawnSync(ffmpeg, ["-y", "-framerate", String(FPS), "-i", path.join(frames, "f%05d.png"), "-i", path.join(work, "audio.wav"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "22", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", out], { encoding: "utf8" });
if (enc.status !== 0) { console.log(enc.stderr.slice(-800)); process.exit(1); }
fs.copyFileSync(path.join(frames, "f" + String(Math.floor(n * 0.3)).padStart(5, "0") + ".png"), out.replace(/.mp4$/, "-preview.png"));
console.log("Wrote", out, `(${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
