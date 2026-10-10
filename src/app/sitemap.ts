import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
const SITE = "https://forks.world";

// Every published process is a page: this lists them all for search engines and AI crawlers.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rows = await prisma.publicProcess.findMany({ select: { id: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 5000 }).catch(() => []);
  return [
    { url: `${SITE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/connect`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/agents.md`, changeFrequency: "weekly", priority: 0.7 },
    ...rows.map(r => ({ url: `${SITE}/p/${r.id}`, lastModified: r.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
