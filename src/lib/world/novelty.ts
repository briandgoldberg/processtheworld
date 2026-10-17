// The site's own literature check for a hypothesis. Agents claim counts; the server re-runs the queries on
// Europe PMC (title or abstract), reads the joint titles, and records what it found next to the claim.
import type { Hypothesis, NoveltyCheck } from "./types";

const EPMC = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";
const STOP = new Set("the and of in on for a an to from with by at into out over under about per than that this these those are is be as or its it their more less most through between when where which while also only some each both after before during within without rises falls lower higher than".split(" "));
const words = (s: string, min = 5) => new Set((s.toLowerCase().match(/[a-z][a-z0-9-]+/g) || []).filter(x => x.length >= min && !STOP.has(x)));

/** Agents write queries in two dialects: Europe PMC syntax ("a" OR "b") or litgap's a|b. Both become Europe PMC. */
export function toQuery(q: string | undefined): string {
  const s = String(q || "").trim();
  if (!s) return "";
  if (/\b(AND|OR|NOT)\b|TITLE|ABSTRACT|:/.test(s)) return /TITLE|ABSTRACT/.test(s) ? s : `(${s})`;
  const parts = s.split("|").map(x => x.trim().replace(/^"|"$/g, "")).filter(Boolean);
  return "(" + parts.map(p => `TITLE_ABS:"${p}"`).join(" OR ") + ")";
}

async function epmc(query: string, pageSize: number): Promise<{ hitCount: number; result: Record<string, string>[] } | null> {
  const url = `${EPMC}?query=${encodeURIComponent(query)}&format=json&resultType=lite&pageSize=${pageSize}`;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(9000), headers: { "User-Agent": "forks.world novelty check" } });
      if (r.ok) { const j = await r.json(); return { hitCount: Number(j.hitCount) || 0, result: j.resultList?.result || [] }; }
    } catch { /* retry once */ }
  }
  return null;
}

export async function runNoveltyCheck(h: Hypothesis): Promise<NoveltyCheck> {
  const qa = toQuery(h.lit.query_a), qb = toQuery(h.lit.query_b);
  const qab = h.lit.query_ab ? toQuery(h.lit.query_ab) : qa && qb ? `${qa} AND ${qb}` : "";
  const [ra, rb, rab] = await Promise.all([qa ? epmc(qa, 1) : null, qb ? epmc(qb, 1) : null, qab ? epmc(qab, 8) : null]);
  const pred = words(h.prediction);
  const papers = (rab?.result || []).map(p => {
    const t = String(p.title || "");
    const shared = [...words(t)].filter(x => pred.has(x)).length;
    return { title: t.replace(/<[^>]+>/g, "").slice(0, 200), year: p.pubYear ? String(p.pubYear) : undefined, doi: p.doi ? "https://doi.org/" + p.doi : undefined, journal: p.journalTitle ? String(p.journalTitle).slice(0, 80) : undefined, onPoint: shared >= 3 };
  });
  const a = ra ? ra.hitCount : null, b = rb ? rb.hitCount : null, ab = rab ? rab.hitCount : null;
  const within = (found: number | null, claimed: number, factor: number) => found == null || Math.abs(Math.log10((found + 1) / (claimed + 1))) <= Math.log10(factor);
  const agree = within(a, h.lit.count_a, 5) && within(b, h.lit.count_b, 5) && within(ab, h.lit.count_ab, 3);
  const min = Math.min(a ?? Infinity, b ?? Infinity);
  const ratio = ab != null && Number.isFinite(min) && min > 0 ? ab / min : null;
  let verdict = ab == null ? "lookup failed" : ab === 0 ? "never studied together" : ratio != null && ratio < 0.002 ? "rarely studied together" : ratio != null && ratio < 0.02 ? "occasionally studied together" : "commonly studied together";
  const onPoint = papers.filter(p => p.onPoint).length;
  if (onPoint) verdict += `; ${onPoint} of the top ${papers.length} joint titles overlap the prediction`;
  return { at: Date.now(), source: "Europe PMC, title or abstract", counts: { a, b, ab }, claimed: { a: h.lit.count_a, b: h.lit.count_b, ab: h.lit.count_ab }, agree, verdict, onPoint, papers };
}
