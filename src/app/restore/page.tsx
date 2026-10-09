"use client";
import { useState } from "react";

// The emailed sign-in link lands here. The token is only used when the person
// clicks Continue, so email scanners that open links can't use it up.
export default function Restore() {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [msg, setMsg] = useState("");
  async function go() {
    setState("busy");
    const token = new URLSearchParams(location.search).get("token") || "";
    let oldKey: string | null = null;
    try { oldKey = localStorage.getItem("ptw_key"); } catch {}
    const r = await fetch("/api/auth/restore", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, oldKey }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setState("error"); setMsg(d.error || "That link didn't work. Request a new one."); return; }
    try { localStorage.setItem("ptw_key", d.key); localStorage.setItem("ptw_in", "1"); } catch {}
    location.href = "/?alert=signed-in";
  }
  return (
    <div className="login"><div className="login-card">
      <div className="mark"><i>PW</i>Process the World</div>
      <h1>Sign in on this device</h1>
      <p>Your saved maps will open here. Anything you made on this device without signing in moves into your account.</p>
      <div><button className="btn primary" onClick={go} disabled={state === "busy"}>{state === "busy" ? "Signing in…" : "Continue"}</button></div>
      {msg && <p role="alert" style={{ color: "var(--danger)" }}>{msg} <a href="/">Back to Process the World</a></p>}
    </div></div>
  );
}
