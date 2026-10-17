"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: [string, string][] = [
  ["/", "Home"], ["/map/p0", "Explore"], ["/hypotheses", "Open Questions"], ["/impact", "Impact"],
];

export default function SiteHeader() {
  const path = usePathname() || "/";
  const on = (href: string) => (href === "/" ? path === "/" : href === "/map/p0" ? path.startsWith("/map") : path === href || path.startsWith(href + "/") || (href === "/search" && path.startsWith("/e/")));
  return (
    <header className="site-header">
      <div className="wrap">
        <div className="brandwrap">
          <Link href="/" className="brand"><i aria-hidden="true"><svg viewBox="0 0 18 22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v6a5 5 0 005 5m0 0a5 5 0 005-5V2M9 2v11m0 0v7" /></svg></i><span>forks<em>.world</em></span></Link>
          <span className="tag">Mapping how the Earth works</span>
        </div>
        <nav id="main-nav" className="nav" aria-label="Main">
          {NAV.map(([href, label]) => <Link key={href} href={href} aria-current={on(href) ? "page" : undefined}>{label}</Link>)}
        </nav>
      </div>
    </header>
  );
}
