import { ImageResponse } from "next/og";

// Generated thumbnail art: a soft gradient and one big emoji. For people (and
// AIs) who want a good-looking thumbnail without making an image.

function hex(h: number, s: number, l: number) {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return `#${[f(0), f(8), f(4)].map(x => x.toString(16).padStart(2, "0")).join("")}`;
}

export async function artDataUrl(emoji: string, hue: number): Promise<string> {
  const h = (((Number(hue) || 210) % 360) + 360) % 360;
  const glyph = String(emoji || "🗺️").slice(0, 16);
  const res = new ImageResponse(
    (
      <div style={{ width: 800, height: 420, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", background: `linear-gradient(135deg, ${hex(h, 62, 30)} 0%, ${hex((h + 40) % 360, 70, 52)} 100%)` }}>
        <div style={{ position: "absolute", left: -90, top: -110, width: 380, height: 380, borderRadius: 190, background: "rgba(255,255,255,0.10)", display: "flex" }} />
        <div style={{ position: "absolute", right: -70, bottom: -130, width: 420, height: 420, borderRadius: 210, background: "rgba(255,255,255,0.08)", display: "flex" }} />
        <div style={{ display: "flex", fontSize: 190 }}>{glyph}</div>
      </div>
    ),
    { width: 800, height: 420 },
  );
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:image/png;base64,${buf.toString("base64")}`;
}
