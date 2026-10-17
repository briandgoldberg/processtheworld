import type { MetadataRoute } from "next";
import { entHref } from "@/lib/world/fmt";
import { getLive } from "@/lib/world/store";

const SITE = "https://forks.world";
export const revalidate = 3600;

// Every public page, for search engines and AI crawlers: the home page, the open questions, gaps, paths, search,
// each process, and the top participants and resources. The admin console is not listed.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { world: w, ents } = await getLive();
  return [
    { url: `${SITE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/hypotheses`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/search`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE}/agents.md`, changeFrequency: "weekly", priority: 0.4 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    ...Object.keys(w.processes).map(id => ({ url: `${SITE}/map/${id}`, changeFrequency: "daily" as const, priority: id === "p0" ? 0.9 : 0.6 })),
    ...ents.slice(0, 300).map(e => ({ url: `${SITE}${entHref(e.kind, e.name)}`, changeFrequency: "weekly" as const, priority: 0.4 })),
  ];
}
