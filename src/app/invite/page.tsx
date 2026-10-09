"use client";
import { useEffect, useState } from "react";

type Info = { title: string; inviter: string; email: string; role: string; hasAccount: boolean };

// Lands here from an emailed invite. Accepting signs the person up (or in)
// and adds the process to "Shared with me". Nothing happens until they click,
// so link scanners can't use up the invite.
export default function Invite() {
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [handle, setHandle] = useState("");
  const token = typeof window !== "undefined" ? new URLSearchParams(location.search).get("token") || "" : "";
  useEffect(() => {
    if (!token) { setErr("This invite link is incomplete."); return; }
    fetch("/api/invites/" + token).then(r => r.json().then(d => (r.ok ? setInfo(d) : setErr(d.error || "This invite doesn't work anymore."))));
  }, [token]);
  async function accept(e: React.FormEvent) {
    e.preventDefault();
    if (handle && !/^[A-Za-z0-9._-]{3,24}$/.test(handle)) { setErr("Usernames are 3–24 letters, numbers, dots, dashes or underscores."); return; }
    setBusy(true); setErr("");
    let oldKey: string | null = null;
    try { oldKey = localStorage.getItem("ptw_key"); } catch {}
    const r = await fetch("/api/invites/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, oldKey, handle }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setBusy(false); setErr(d.error || "That didn't work. Try again."); return; }
    try { localStorage.setItem("ptw_key", d.key); localStorage.setItem("ptw_in", "1"); } catch {}
    location.href = "/?alert=invited";
  }
  return (
    <div className="login"><div className="login-card">
      <a className="mark" href="/" style={{ textDecoration: "none", color: "inherit" }}><i>PW</i>Process the World</a>
      {info ? (
        <>
          <h1>{info.inviter} shared “{info.title}” with you</h1>
          <p>{info.hasAccount ? `Continue to sign in as ${info.email} and open it.` : `Accepting creates your account for ${info.email}. No password needed.`} You {info.role === "view" ? "can view" : "can view and edit"} this process.</p>
          <form className="acct-form login-box" onSubmit={accept}>
            {!info.hasAccount && (<>
              <label className="label" htmlFor="inv-handle">Username <span className="opt">(optional)</span></label>
              <input id="inv-handle" value={handle} onChange={e => setHandle(e.target.value)} maxLength={24} placeholder="Pick a username" autoComplete="username" />
            </>)}
            <button className="btn primary" disabled={busy}>{busy ? "Accepting…" : "Accept invite"}</button>
          </form>
        </>
      ) : !err ? <p className="hint">Loading your invite…</p> : null}
      {err && <p role="alert" style={{ color: "var(--danger)" }}>{err} <a href="/">Go to Process the World</a></p>}
    </div></div>
  );
}
