import type { MetadataRoute } from "next";
import { libraryItems, tagCounts, SITE } from "@/lib/library";

export const revalidate = 3600;

// Every public page, for search engines and AI crawlers. Rebuilt hourly so it is always quick to fetch.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const items = await libraryItems();
  const newest = items.reduce((d, i) => (i.updatedAt > d ? i.updatedAt : d), new Date(0));
  return [
    { url: `${SITE}/`, lastModified: newest, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/library`, lastModified: newest, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/connect`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/agents.md`, changeFrequency: "weekly", priority: 0.5 },
    ...tagCounts(items).slice(0, 150).map(t => ({ url: `${SITE}/topics/${t.slug}`, lastModified: newest, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...items.map(r => ({ url: `${SITE}/p/${r.id}`, lastModified: r.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
