// Public processes are frozen: nothing about the published map can change. These helpers let the
// owner's private copy keep saving things that are not part of the map (chat notes, ratings).
export const FROZEN_MESSAGE = "Public processes cannot be changed.";

function stable(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v as object).sort().filter(k => (v as any)[k] !== undefined).map(k => JSON.stringify(k) + ":" + stable((v as any)[k])).join(",") + "}";
  return JSON.stringify(v ?? null);
}

/** True when the incoming doc has the same title and maps as the published snapshot. */
export function sameAsPublic(doc: any, pub: { title: string; doc: any }): boolean {
  return (doc?.title ?? "") === pub.title && stable(doc?.maps) === stable(pub.doc?.maps);
}
