"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type R = { entities: { key: string; name: string; kind: string; steps: number; processes: number }[]; processes: { id: string; title: string }[]; steps: { id: string; label: string; process: string; processTitle?: string }[] };
const enc = (s: string) => encodeURIComponent(s.toLowerCase().trim().replace(/\s+/g, " "));

export default function HeaderSearch() {
  const [q, setQ] = useState("");
  const [r, setR] = useState<R | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setR(null); return; }
    const t = setTimeout(async () => {
      try { const res = await fetch("/api/world/read/search?q=" + encodeURIComponent(q)); if (res.ok) { setR(await res.json()); setOpen(true); } } catch { /* offline */ }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const none = r && !r.entities.length && !r.processes.length && !r.steps.length;
  return (
    <div className="searchbox" ref={box}>
      <input type="search" placeholder="Search processes, oxygen, microbes…" value={q} onChange={e => setQ(e.target.value)} onFocus={() => r && setOpen(true)}
        onKeyDown={e => { if (e.key === "Escape") setOpen(false); }} aria-label="Search the map" />
      {open && r && (
        <div className="results" role="listbox">
          {none && <h4>No matches</h4>}
          {r.entities.length > 0 && <h4>Participants and resources</h4>}
          {r.entities.map(e => <Link key={e.key} href={`/e/${e.kind}/${enc(e.name)}`} onClick={() => setOpen(false)}><span>{e.name} <span className="pill">{e.kind}</span></span><span className="small muted">{e.processes} processes</span></Link>)}
          {r.processes.length > 0 && <h4>Processes</h4>}
          {r.processes.map(p => <Link key={p.id} href={`/map/${p.id}`} onClick={() => setOpen(false)}>{p.title}</Link>)}
          {r.steps.length > 0 && <h4>Steps</h4>}
          {r.steps.map(s => <Link key={s.id} href={`/map/${s.process}#${s.id}`} onClick={() => setOpen(false)}><span>{s.label}</span><span className="small muted">{s.processTitle}</span></Link>)}
          <h4><Link href={`/search?q=${encodeURIComponent(q)}`} onClick={() => setOpen(false)} style={{ padding: 0 }}>See all results</Link></h4>
        </div>
      )}
    </div>
  );
}
