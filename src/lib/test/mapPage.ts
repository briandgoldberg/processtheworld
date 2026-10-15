import { flowHtml } from "@/lib/flowHtml";
import { worldDoc } from "@/lib/test/toDoc";

type D = ReturnType<typeof worldDoc>;
const key = (id: string) => (id === "p0" ? "m_root" : id);
const url = (k: string) => "/test/map/" + (k === "m_root" ? "p0" : k);
export const processIds = () => Object.keys(worldDoc().maps).map(k => (k === "m_root" ? "p0" : k));

/** One layer of the test process, drawn as swim lanes. A step marked with an arrow opens its subprocess page. */
export function mapPage(id: string): Response | null {
  const doc: D = worldDoc();
  const m = doc.maps[key(id)] as { title?: string; steps: unknown[]; parent?: { map: string } | null } | undefined;
  if (!m) return null;
  const html = flowHtml(doc as Parameters<typeof flowHtml>[0], { url: "https://forks.world/test", only: key(id) })
    .replace(/>PERSONA</g, ">PARTICIPANTS<").replace(/>TECHNOLOGY</g, ">RESOURCES<")
    .replace(/<p class="sub">[\s\S]*?<\/p>/, '<p class="sub">' + m.steps.length + " steps in this layer. Click a step marked ↘ to open its subprocess. A grey line under a step names a link to another layer. Top lanes are the layer's most common participants; the lower lanes are its most common resources, and a step lists the resources it uses.</p>")
    .replace(/href="#([A-Za-z0-9_]+)"/g, (_x, k) => 'href="' + url(k) + '"')
    .replace(/<footer>[\s\S]*?<\/footer>/, '<footer><a href="/test">Back to the test</a>' + (m.parent ? ' · <a href="' + url(m.parent.map) + '">Up one layer</a>' : "") + "</footer>");
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
