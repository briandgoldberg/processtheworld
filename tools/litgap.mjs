#!/usr/bin/env node
// How often is each topic studied, and how often together? Counts papers (title or abstract) in Europe PMC
// (life, agricultural and environmental science, preprints included). Calls are serialized across agents.
//   node tools/litgap.mjs "earthworm" "freeze-thaw|freezing" ["nitrous oxide|N2O"]
// Each argument is one concept; use "a|b" for synonyms. Prints counts and the co-study ratio.
// A pair with big separate counts and a tiny joint count is a literature gap.
//   node tools/litgap.mjs --papers "earthworm" "nitrous oxide|N2O"   lists the 6 most relevant joint papers (title, year, DOI, abstract start)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const args = process.argv.slice(2);
const papers = args[0] === "--papers";
const concepts = papers ? args.slice(1) : args;
if (concepts.length < 2) { console.error('usage: node tools/litgap.mjs [--papers] "concept A" "concept B" ["concept C"]'); process.exit(1); }
const LOCK = path.join(os.tmpdir(), "world-europepmc.lock");
async function serial(fn) {
  for (let i = 0; i < 600; i++) { try { fs.closeSync(fs.openSync(LOCK, "wx")); break; } catch { if (i > 590) fs.rmSync(LOCK, { force: true }); await new Promise(r => setTimeout(r, 150 + Math.random() * 200)); } }
  try { return await fn(); } finally { await new Promise(r => setTimeout(r, 350)); fs.rmSync(LOCK, { force: true }); }
}
const term = c => "(" + c.split("|").map(s => `TITLE_ABS:"${s.trim()}"`).join(" OR ") + ")";
const query = list => list.map(term).join(" AND ");
async function search(list, extra) {
  const url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=" + encodeURIComponent(query(list)) + "&format=json&" + extra;
  return serial(async () => {
    for (let i = 0; i < 4; i++) { try { const r = await fetch(url); if (r.ok) return await r.json(); } catch {} await new Promise(r => setTimeout(r, 1000 * (i + 1))); }
    return null;
  });
}
if (papers) {
  const j = await search(concepts, "pageSize=6&resultType=core");
  const list = j?.resultList?.result || [];
  console.log(JSON.stringify({ hitCount: j?.hitCount ?? null, papers: list.map(p => ({ title: p.title, year: p.pubYear, journal: p.journalTitle, doi: p.doi ? "https://doi.org/" + p.doi : null, abstract: (p.abstractText || "").replace(/<[^>]+>/g, "").slice(0, 400) })) }, null, 1));
} else {
  const out = { source: "Europe PMC", concepts, single: [], joint: null };
  for (const c of concepts) { const j = await search([c], "pageSize=1&resultType=idlist"); out.single.push(j ? j.hitCount : null); }
  const jj = await search(concepts, "pageSize=1&resultType=idlist"); out.joint = jj ? jj.hitCount : null;
  const min = Math.min(...out.single);
  out.ratio = out.joint != null && min ? +(out.joint / min).toFixed(5) : null;
  out.verdict = out.joint == null ? "lookup failed" : out.joint === 0 ? "never studied together" : out.ratio < 0.002 ? "rarely studied together" : out.ratio < 0.02 ? "occasionally studied together" : "commonly studied together";
  console.log(JSON.stringify(out, null, 1));
}
