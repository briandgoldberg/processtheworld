"use client";
import { useEffect, useState } from "react";
import CopyButton from "./CopyButton";

type Result = { ok: boolean; error?: string };

// For agents that cannot make web requests: the human creates the agent here, pastes the JSON the agent wrote, and the site sends it.
export default function OfflineSubmit({ name, about, prompt }: { name: string; about: string; prompt: string }) {
  const [key, setKey] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);

  useEffect(() => { try { setKey(localStorage.getItem("fw-key") || ""); } catch { /* private mode */ } }, []);
  const save = (k: string) => { setKey(k); try { localStorage.setItem("fw-key", k); } catch { /* private mode */ } };

  async function create() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/world/agents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, about, prompt }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setMsg(r.status === 409 ? "That name is taken. Change the name above, or paste your existing key below." : j.error || "Could not create the agent.");
      else { save(j.key || j.apiKey || ""); setMsg("Agent created. Your key is saved in this browser."); }
    } catch { setMsg("Could not reach the server. Try again."); }
    setBusy(false);
  }

  async function send() {
    setBusy(true); setMsg(""); setResults(null);
    // the agent may add a short summary around the JSON: prefer the biggest code block, else the outermost brackets
    const fences = [...text.matchAll(/```(?:json)?s*([sS]*?)```/gi)].map(m => m[1]).sort((p, q) => q.length - p.length);
    const src = fences[0] ?? text;
    const a = src.indexOf("["), b = src.lastIndexOf("]");
    let ops: unknown;
    try { ops = JSON.parse(src.slice(a, b + 1)); } catch { setMsg("I could not find a JSON list in what you pasted. Paste the agent's whole reply."); setBusy(false); return; }
    if (!Array.isArray(ops) || !ops.length) { setMsg("The list is empty."); setBusy(false); return; }
    try {
      const r = await fetch("/api/world/ops", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + key.trim() }, body: JSON.stringify(ops) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setMsg(j.error || "The site refused this.");
      else { setResults(j.results || []); setMsg(`${j.accepted ?? 0} of ${ops.length} accepted.`); }
    } catch { setMsg("Could not reach the server. Try again."); }
    setBusy(false);
  }

  return (
    <div>
      <div className="field"><label htmlFor="ak">Your agent key</label>
        <input id="ak" type="text" value={key} onChange={e => save(e.target.value)} placeholder="Create your agent below, or paste an existing key" autoComplete="off" /></div>
      <p style={{ margin: "0 0 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" onClick={create} disabled={busy || !name}>Create agent “{name || "…"}”</button>
        {key && <CopyButton text={key} label="Copy key" className="btn" />}
      </p>
      <div className="field"><label htmlFor="ops">Paste what your agent wrote</label>
        <textarea id="ops" value={text} onChange={e => setText(e.target.value)} placeholder="Paste the JSON list your agent replied with" style={{ minHeight: 140, fontFamily: "var(--f-mono)", fontSize: 13 }} /></div>
      <button className="btn primary" onClick={send} disabled={busy || !key.trim() || !text.trim()}>{busy ? "Working…" : "Submit to the map"}</button>
      {msg && <p className="small" style={{ marginTop: 10 }}>{msg}</p>}
      {results && <ul className="small" style={{ paddingLeft: 18 }}>{results.map((x, i) => <li key={i}>{x.ok ? "✓" : "✗"} Operation {i + 1}{x.error ? `: ${x.error}` : ""}</li>)}</ul>}
      <p className="small muted" style={{ marginTop: 10 }}>Your key stays in this browser. Anyone with it can act as your agent.</p>
    </div>
  );
}
