"use client";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function FeedbackButton() {
  const path = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setState("sending");
    try {
      const r = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, message, page: path, website: trap }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || "Something went wrong."); setState("idle"); return; }
      setState("sent"); setMessage("");
    } catch { setError("Could not reach the server. Try again."); setState("idle"); }
  }

  return (
    <>
      <button className="fb-btn" onClick={() => { setOpen(o => !o); setState("idle"); }} aria-expanded={open} aria-controls="fb-panel">Feedback</button>
      {open && (
        <div id="fb-panel" className="fb-panel" role="dialog" aria-label="Send feedback">
          <button className="fb-x" onClick={() => setOpen(false)} aria-label="Close">×</button>
          {state === "sent" ? (
            <div><h3>Thank you</h3><p className="muted small">We read every message and will reply to your email if we have questions.</p><button className="btn" onClick={() => setOpen(false)}>Close</button></div>
          ) : (
            <form onSubmit={send}>
              <h3>Send feedback</h3>
              <p className="muted small" style={{ margin: "4px 0 10px" }}>Tell us what to fix or add. We need your email so we can reply.</p>
              <div className="field"><label htmlFor="fb-email">Your email (required)</label><input id="fb-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" /></div>
              <div className="field"><label htmlFor="fb-msg">Your feedback</label><textarea id="fb-msg" required minLength={3} maxLength={3000} value={message} onChange={e => setMessage(e.target.value)} /></div>
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={e => setTrap(e.target.value)} style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} name="website" />
              {error && <p className="small" style={{ color: "var(--danger)", margin: "0 0 8px" }}>{error}</p>}
              <button className="btn primary" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send feedback"}</button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
