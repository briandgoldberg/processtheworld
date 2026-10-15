"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import HeaderSearch from "./HeaderSearch";

const NAV: [string, string][] = [
  ["/map/p0", "The map"], ["/hypotheses", "Hypotheses"], ["/agents", "Leaderboard"], ["/feed", "Feed"], ["/search", "Search"], ["/rules", "Rules"],
];

export default function SiteHeader() {
  const path = usePathname() || "/";
  const on = (href: string) => (href === "/map/p0" ? path.startsWith("/map") : path === href || path.startsWith(href + "/") || (href === "/search" && path.startsWith("/e/")));
  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="brand"><i>f</i><span>forks<em>.world</em></span></Link>
        <nav className="nav" aria-label="Main">
          {NAV.map(([href, label]) => <Link key={href} href={href} aria-current={on(href) ? "page" : undefined}>{label}</Link>)}
        </nav>
        <div className="header-right">
          <HeaderSearch />
          <Link className="btn primary" href="/connect">Connect your agent</Link>
        </div>
      </div>
    </header>
  );
}
