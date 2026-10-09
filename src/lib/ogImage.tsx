import { ImageResponse } from "next/og";
import { prisma } from "./db";
import { layout } from "./flowHtml";

// The preview picture for a shared process: its title, the numbers, and a
// sketch of the swim-lane map. Shown when the link is pasted into X, Slack, etc.

const W = 1200, H = 630;

function sketch(doc: any, bw: number, bh: number): string {
  const maps = doc?.maps || {};
  const m = maps.m_root || Object.values(maps)[0] as any;
  if (!m || !m.steps?.length) return "";
  const g = layout(m);
  const s = Math.min(bw / g.width, bh / Math.max(g.height, 60));
  const w = g.width * s, h = Math.max(g.height, 60) * s;
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${bw}" height="${bh}" viewBox="0 0 ${bw} ${bh}">`];
  const ox = (bw - w) / 2, oy = (bh - h) / 2;
  const laneType = new Map<string, string>(m.lanes.map((l: any) => [l.id, l.type]));
  g.lanes.forEach((l: any) => {
    out.push(`<rect x="${ox}" y="${oy + g.laneY[l.id] * s}" width="${w}" height="${g.laneH[l.id] * s}" fill="${l.type === "system" ? "#E5F3F2" : "#FBF3E6"}" stroke="#D7DDE5" stroke-width="1"/>`);
  });
  const BW = 158, BH = 60;
  for (const st of m.steps) {
    const a = g.pos[st.id];
    for (const n of st.next || []) {
      const b = g.pos[n.to]; if (n.map || !b) continue;
      const x1 = ox + (a.x + BW) * s, y1 = oy + (a.y + BH / 2) * s, x2 = ox + b.x * s, y2 = oy + (b.y + BH / 2) * s;
      const forward = b.x > a.x;
      out.push(`<path d="${forward ? `M${x1} ${y1} C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}` : `M${x1 - BW * s / 2} ${y1 + BH * s / 2} C${x1 - BW * s / 2} ${y1 + 40 * s} ${x2 + BW * s / 2} ${y2 + 40 * s} ${x2 + BW * s / 2} ${y2 + BH * s / 2}`}" fill="none" stroke="#2F3B4C" stroke-width="${Math.max(1.4, 2.2 * s * 2)}" ${forward ? "" : 'stroke-dasharray="6 4"'}/>`);
    }
  }
  for (const st of m.steps) {
    const p = g.pos[st.id], sys = laneType.get(st.lane) === "system";
    const fill = st.kind === "start" ? "#DDF3E4" : st.kind === "end" ? "#E1E8FB" : st.kind === "decision" ? "#FDF0D5" : "#FFFFFF";
    const stroke = st.kind === "start" ? "#1E7B47" : st.kind === "end" ? "#2448C9" : st.kind === "decision" ? "#E8A317" : sys ? "#0D7672" : "#A86A12";
    const r = st.kind === "start" || st.kind === "end" ? BH * s / 2 : 8 * s * 2;
    out.push(`<rect x="${ox + p.x * s}" y="${oy + p.y * s}" width="${BW * s}" height="${BH * s}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${Math.max(1.6, 2 * s * 2)}"/>`);
    if (st.pain) out.push(`<circle cx="${ox + (p.x + BW) * s - 2}" cy="${oy + p.y * s + 2}" r="${Math.max(5, 11 * s * 1.6)}" fill="${st.pain.level >= 3 ? "#C92A2A" : st.pain.level === 2 ? "#E8590C" : "#E8A317"}"/>`);
  }
  out.push("</svg>");
  return out.join("");
}

export async function renderOg(publicId: string) {
  const r = await prisma.publicProcess.findUnique({ where: { id: publicId }, select: { title: true, authorName: true, stepCount: true, depth: true, doc: true, tags: true } }).catch(() => null);
  const title = r?.title || "Process the World";
  const svg = r ? sketch(r.doc, 1100, 330) : "";
  const stats = r ? `${r.stepCount} steps · ${r.depth} ${r.depth === 1 ? "layer" : "layers"} · by ${r.authorName}` : "Map how anything gets done";
  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: "#F3F5F8", padding: 50, fontFamily: "sans-serif", color: "#141C27" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, fontWeight: 700 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: "#2448C9", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19 }}>PW</div>
          Process the World
        </div>
        <div style={{ display: "flex", fontSize: title.length > 70 ? 40 : title.length > 38 ? 48 : 60, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.5, marginTop: 22, maxHeight: 150, overflow: "hidden" }}>{title}</div>
        <div style={{ display: "flex", fontSize: 26, color: "#5A6573", marginTop: 12 }}>{stats}</div>
        {svg ? (
          <div style={{ display: "flex", marginTop: 22, background: "#fff", border: "2px solid #D7DDE5", borderRadius: 18, padding: 0, width: 1100, height: 330 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`} width={1100} height={330} alt="" />
          </div>
        ) : null}
      </div>
    ),
    { width: W, height: H },
  );
}
