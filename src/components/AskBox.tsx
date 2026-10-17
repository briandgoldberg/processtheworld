"use client";
import Link from "next/link";
import { useState } from "react";
import Linked from "@/components/Linked";

type Line = { id: string; from: { id: string; label: string; process: string }; to: { id: string; label: string; process: string }; direction: string; size: number; note: string; elasticity?: number; hypothesis: boolean; sources: string[] };
type Answer = { answer: string; lines: Line[]; usage: { input: number; output: number; usd: number } };

const EXAMPLES = ["What happens to coastal fisheries if dams trap more river sediment?", "How does a warmer winter change methane from wetlands?", "What does ocean acidification do to clouds?", "If farmers spread crushed basalt, what else changes?"];

export default function AskBox() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Answer | null>(null);
  const ask = async (question: string) => {
    const t = question.trim(); if (t.length < 8 || busy) return;
    setBusy(true); setErr(null); setRes(null); setQ(t);
    try {
      const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: t }) });
      const j = await r.json();
      if (!r.ok) setErr(j.error || "Something went wrong."); else setRes(j);
    } catch { setErr("Could not reach the site."); }
    setBusy(false);
  };
  const inputStyle = { border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 12, padding: "12px 14px", fontSize: 16, flex: "1 1 320px" } as const;
  return (
    <div>
      <form className="ctas" style={{ alignItems: "stretch" }} onSubmit={e => { e.preventDefault(); ask(q); }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="What happens to … if …?" aria-label="Your question" maxLength={600} style={inputStyle} />
        <button className="btn primary big" type="submit" disabled={busy || q.trim().length < 8}>{busy ? "Tracing…" : "Ask"}</button>
      </form>
      {!res && !busy && <p className="small muted" style={{ margin: "10px 0 0" }}>Try: {EXAMPLES.map((x, i) => <span key={x}>{i > 0 && " · "}<button type="button" className="asbtn link" onClick={() => ask(x)}>{x}</button></span>)}</p>}
      {busy && <p className="muted" style={{ marginTop: 16 }}>Searching the map and following the lines. This takes 15 to 40 seconds.</p>}
      {err && <p style={{ marginTop: 16, color: "var(--warn)" }}>{err}</p>}
      {res && (
        <div style={{ marginTop: 20 }}>
          <div className="card">{res.answer.split(/\n{2,}|\n/).filter(Boolean).map((p, i) => <p key={i} style={{ margin: i ? "10px 0 0" : 0, fontSize: 17, lineHeight: 1.55 }}>{p}</p>)}</div>
          {res.lines.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>Lines on the map this answer rests on</h3>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {res.lines.map(l => (
                  <li key={l.id} style={{ margin: "8px 0" }}>
                    <Link href={`/map/${l.from.process}#${l.from.id}`}>{l.from.label}</Link> <span className="muted">→</span> <Link href={`/map/${l.to.process}#${l.to.id}`}>{l.to.label}</Link>
                    {l.hypothesis && <span className="pill hyp" style={{ marginLeft: 6 }}>open question</span>}
                    <div className="small muted">{l.direction}{l.size}/5{l.elasticity != null ? `, elasticity ${l.elasticity}` : ""}: {l.note}</div>
                    {l.sources.length > 0 && <div className="small muted">{l.sources.map((s, j) => <span key={j}>{j > 0 && " · "}<Linked text={s} /></span>)}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="small muted" style={{ marginTop: 14 }}>Answered from the map only. Where the map has no line, the answer says so instead of guessing. Cost of this answer: about ${res.usage.usd.toFixed(2)}.</p>
        </div>
      )}
    </div>
  );
}
