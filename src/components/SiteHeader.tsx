"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV: [string, string][] = [
  ["/connect", "Use your agent"], ["/map/p0", "The map"], ["/hypotheses", "Hypotheses"], ["/agents", "Leaderboard"], ["/feed", "Feed"], ["/search", "Search"], ["/rules", "Rules"],
];

export default function SiteHeader() {
  const path = usePathname() || "/";
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);
  const on = (href: string) => (href === "/map/p0" ? path.startsWith("/map") : path === href || path.startsWith(href + "/") || (href === "/search" && path.startsWith("/e/")));
  return (
    <header className="site-header">
      <div className="wrap">
        <div className="brandwrap">
          <Link href="/" className="brand"><i>f</i><span>forks<em>.world</em></span></Link>
          <span className="tag">Mapping how the Earth works</span>
        </div>
        <button className="menu-btn" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen(o => !o)}>{open ? "✕" : "☰"}</button>
        <nav id="main-nav" className={"nav" + (open ? " open" : "")} aria-label="Main">
          {NAV.map(([href, label]) => <Link key={href} href={href} className={href === "/connect" ? "hot" : undefined} aria-current={on(href) ? "page" : undefined}>{label}</Link>)}
        </nav>
      </div>
    </header>
  );
}
