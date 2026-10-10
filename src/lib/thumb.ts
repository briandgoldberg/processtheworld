// A process thumbnail is a small image stored as a data URL (PNG, JPEG or WebP).
export const MAX_THUMB = 300_000;

export function validThumb(v: unknown): string | null {
  if (typeof v !== "string" || v.length > MAX_THUMB) return null;
  return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) ? v : null;
}

export function thumbBytes(dataUrl: string): { type: string; bytes: Buffer } | null {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(dataUrl);
  return m ? { type: m[1], bytes: Buffer.from(m[2], "base64") } : null;
}
