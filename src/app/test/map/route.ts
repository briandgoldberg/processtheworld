import { flowHtml } from "@/lib/flowHtml";
import { worldDoc } from "@/lib/test/toDoc";

export const dynamic = "force-static";

// The /test process drawn as swim lanes, one layer per process. Steps marked ↘ open their detail layer.
export function GET() {
  const html = flowHtml(worldDoc() as Parameters<typeof flowHtml>[0], { url: "https://forks.world/test" })
    .replace(/>PERSONA</g, ">PARTICIPANTS<").replace(/>TECHNOLOGY</g, ">RESOURCES<")
    .replace("Steps with ↘ open into a detail layer below; steps with ↗ open another published process.", "Click a step marked ↘ to open its subprocess. A grey line under a step names a link to another layer. Top lanes are each layer's most common participants; the lower lanes are its most common resources, and a step lists the resources it uses.")
    .replace(/<footer>.*?<\/footer>/, '<footer><a href="/test">Back to the test</a></footer>');
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
