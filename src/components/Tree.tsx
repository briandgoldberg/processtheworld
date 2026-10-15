import Link from "next/link";
import type { World } from "@/lib/world/types";

// The outline of the whole map: every process, nested. The branch you are in is open.
export default function Tree({ w, current, crumbs }: { w: World; current: string; crumbs: string[] }) {
  const kids = (pid: string) => Object.values(w.steps).filter(s => s.process === pid && s.sub && w.processes[s.sub] && s.status === "live").map(s => s.sub!);
  const onPath = new Set(crumbs);
  const render = (pid: string, depth: number): React.ReactNode => {
    const ks = kids(pid); const p = w.processes[pid];
    const label = <Link href={`/map/${pid}`} aria-current={pid === current ? "page" : undefined}>{p.title}</Link>;
    if (!ks.length) return <li key={pid}>{label}</li>;
    return (
      <li key={pid}>
        <details open={onPath.has(pid) || depth === 0}>
          <summary><Link href={`/map/${pid}`} aria-current={pid === current ? "page" : undefined} style={{ display: "inline", padding: 0 }}>{p.title}</Link></summary>
          <ul>{ks.map(k => render(k, depth + 1))}</ul>
        </details>
      </li>
    );
  };
  return <ul className="tree">{render("p0", 0)}</ul>;
}
