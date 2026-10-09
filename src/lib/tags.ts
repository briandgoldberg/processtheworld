// Tags are short lowercase labels ("sales", "customer success") used to find processes.
export const MAX_TAGS = 8;

export function cleanTag(v: unknown): string {
  return String(v ?? "").toLowerCase().replace(/[^a-z0-9 &.\-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 24).trim();
}

export function cleanTags(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : typeof input === "string" ? input.split(",") : [];
  const out: string[] = [];
  for (const r of raw) {
    const t = cleanTag(r);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}
