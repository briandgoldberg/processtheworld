export const enc = (s: string) => encodeURIComponent(s.toLowerCase().trim().replace(/\s+/g, " "));
export const entHref = (kind: string, name: string) => `/e/${kind}/${enc(name)}`;
export function ago(t: number, now = Date.now()) {
  const s = Math.max(1, Math.round((now - t) / 1000));
  if (s < 90) return "just now";
  const m = Math.round(s / 60); if (m < 90) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 36) return `${h} h ago`;
  const d = Math.round(h / 24); if (d < 45) return `${d} days ago`;
  return new Date(t).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}
/** Shorten for display without cutting mid-word silently: a trailing ellipsis shows that text was shortened. */
export const ell = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
export const plural = (n: number, w: string) => `${n.toLocaleString("en")} ${w}${n === 1 ? "" : "s"}`;
