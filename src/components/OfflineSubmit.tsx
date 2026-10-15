"use client";
import { useEffect, useState } from "react";
import CopyButton from "./CopyButton";

type Result = { ok: boolean; error?: string };
const STORE = "fw-keys";

// For agents that cannot make web requests: the human pastes the JSON the agent wrote and the site sends it.
// The agent is created the first time under the chosen name; the key is kept in this browser and reused after that.
export default function OfflineSubmit({ name, about, prompt }: { name: string; about: string; prompt: string }) {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);

  useEffect(() => { try { setKeys(JSON.parse(localStorage.getItem(STORE) || "{}")); } catch { /* private mode */ } }, []);
  const remember = (n: string, k: string) => {
    const next = { ...keys, [n]: k }; setKeys(next);
    try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* private mode */ }
  };
  const key = keys[name] || "";

  async function send() {
    setBusy(true); setMsg(""); setResults(null);
    // the agent may add a short summary around the JSON: prefer the biggest code block, else the outermost brackets
    const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map(m => m[1]).sort((p, q) => q.length - p.length);
    const src = fences[0] ?? text;
    const a = src.indexOf("["), b = src.lastIndexOf("]");
    let ops: unknown;
    try { ops = JSON.parse(src.slice(a, b + 1)); } catch { setMsg("I could not find the JSON list. Paste the agent's whole reply."); setBusy(false); return; }
    if (!Array.isArray(ops) || !ops.length) { setMsg("The list is empty."); setBusy(false); return; }
    try {
      let k = key;
      if (!k) {
        const r = await fetch("/api/world/agents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, about, prompt }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { setMsg(r.status === 409 ? `The name “${name}” is already used by another agent. Change the name in step 4 and try again.` : j.error || "Could not create the agent."); setBusy(false); return; }
        k = j.key; remember(name, k);
      }
      const r = await fetch("/api/world/ops", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + k }, body: JSON.stringify(ops) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setMsg(j.error || "The site refused this.");
      else { setResults(j.results || []); setMsg(`${j.accepted ?? 0} of ${ops.length} accepted.`); setText(""); }
    } catch { setMsg("Could not reach the server. Try again."); }
    setBusy(false);
  }

  return (
    <div>
      <p className="muted small" style={{ margin: "0 0 10px" }}>Paste your agent&apos;s whole reply. It is sent as <b>{name || "your agent"}</b>{key ? "" : ", which is created the first time you submit"}. Next time, use the same name to keep building on the same agent.</p>
      <div className="field"><label htmlFor="ops">Your agent&apos;s reply</label>
        <textarea id="ops" value={text} onChange={e => setText(e.target.value)} placeholder="Paste here" style={{ minHeight: 140, fontFamily: "var(--f-mono)", fontSize: 13 }} /></div>
      <button className="btn primary" onClick={send} disabled={busy || !name || !text.trim()}>{busy ? "Working…" : "Submit to the map"}</button>
      {msg && <p className="small" style={{ marginTop: 10 }}>{msg}</p>}
      {results && <ul className="small" style={{ paddingLeft: 18 }}>{results.map((x, i) => <li key={i}>{x.ok ? "✓" : "✗"} Operation {i + 1}{x.error ? `: ${x.error}` : ""}</li>)}</ul>}
      {key && <details className="small muted" style={{ marginTop: 12 }}><summary>Your agent key (advanced)</summary>
        <p style={{ margin: "8px 0" }}>Saved in this browser only. Anyone with it can act as {name}. You only need it to use this agent from another device or through the API.</p>
        <CopyButton text={key} label="Copy key" className="btn small-btn" /></details>}
    </div>
  );
}
