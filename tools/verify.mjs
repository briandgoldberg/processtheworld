#!/usr/bin/env node
// Evidence verification, tier 1: does each cited source exist? Looks every distinct source up in Crossref.
//   node tools/verify.mjs            check every distinct source not yet in the cache, then print a per-agent report
//   node tools/verify.mjs --report   only print the report from the cache
// Statuses: "doi" (a DOI in the source resolved), "match" (best Crossref hit agrees on year and first author),
// "weak" (hit agrees on year or author only), "none" (nothing agrees: likely wrong or invented), "skip" (not a paper: web page, report, seed).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const dir = path.dirname(fileURLToPath(import.meta.url));
const WORLD = path.join(dir, "..", "src", "lib", "test", "world.json");
const CACHE = path.join(dir, "verify-cache.json");
const w = JSON.parse(fs.readFileSync(WORLD, "utf8"));
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};
const items = [...Object.values(w.steps), ...Object.values(w.edges)].filter(i => i.by !== "seed" && i.status !== "removed");
const sources = [...new Set(items.flatMap(i => i.evidence.map(e => e.source)))];
const STOP = new Set("the and of in on for a an to from with by at et al journal science nature review annual press university".split(" "));
const words = s => (s.toLowerCase().match(/[a-z]{4,}/g) || []).filter(x => !STOP.has(x));
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) { for (let i = 0; i < 3; i++) { try { const r = await fetch(url, { headers: { "User-Agent": "forks-world-verify/1.0" } }); if (r.status === 404) return { notFound: true }; if (r.ok) return await r.json(); } catch {} await sleep(800 * (i + 1)); } return null; }
async function check(src) {
  const doi = (src.match(/10\.\d{4,9}\/[^\s"<>)]+/) || [])[0]?.replace(/[.,;]+$/, "");
  if (doi) {
    const j = await get("https://api.crossref.org/works/" + encodeURIComponent(doi));
    if (j && j.message) return { status: "doi", title: (j.message.title || [])[0] };
    if (j && j.notFound) return { status: "none", why: "DOI does not resolve" };
  }
  const year = (src.match(/\b(19[4-9]\d|20[0-3]\d)\b/) || [])[0];
  if (!year && !/[A-Z][a-z]+/.test(src)) return { status: "skip" };
  if (/^(https?:|www\.)/.test(src) && !year) return { status: "skip" };
  const j = await get("https://api.crossref.org/works?rows=3&select=title,author,issued,container-title&query.bibliographic=" + encodeURIComponent(src.slice(0, 220)));
  const hits = j?.message?.items || [];
  const sw = new Set(words(src));
  let best = { status: "none" };
  for (const h of hits) {
    const y = h.issued?.["date-parts"]?.[0]?.[0];
    const au = (h.author || []).map(a => (a.family || "").toLowerCase()).filter(Boolean);
    const authorOk = au.slice(0, 3).some(a => a.length > 2 && src.toLowerCase().includes(a));
    const yearOk = year && y && Math.abs(y - Number(year)) <= 1;
    const titleOk = words((h.title || [])[0] || "").filter(x => sw.has(x)).length >= 2;
    const st = authorOk && (yearOk || titleOk) ? "match" : authorOk || yearOk && titleOk ? "weak" : "none";
    if (st === "match" || (st === "weak" && best.status === "none")) best = { status: st, title: (h.title || [])[0] };
    if (st === "match") break;
  }
  return best;
}
if (!process.argv.includes("--report")) {
  const todo = sources.filter(s => !cache[s]);
  console.error(`${sources.length} distinct sources, ${todo.length} to check`);
  let n = 0;
  for (const s of todo) {
    cache[s] = await check(s); await sleep(220);
    if (++n % 50 === 0) { fs.writeFileSync(CACHE, JSON.stringify(cache)); console.error(`  ${n}/${todo.length}`); }
  }
  fs.writeFileSync(CACHE, JSON.stringify(cache));
}
const per = {};
for (const i of items) for (const e of i.evidence) {
  const r = (per[i.by] ||= { n: 0, doi: 0, match: 0, weak: 0, none: 0, skip: 0 });
  const st = cache[e.source]?.status || "skip";
  r.n++; r[st]++;
}
console.log("agent        evidence  verified(doi+match)  weak  not-found  skipped");
for (const [a, r] of Object.entries(per).sort((x, y) => y[1].n - x[1].n)) {
  const checked = r.n - r.skip;
  console.log(`${a.padEnd(12)} ${String(r.n).padStart(8)}  ${String(r.doi + r.match).padStart(8)} (${checked ? Math.round((100 * (r.doi + r.match)) / checked) : 0}%)  ${String(r.weak).padStart(6)}  ${String(r.none).padStart(8)}  ${String(r.skip).padStart(6)}`);
}
