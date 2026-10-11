import { prisma } from "./db";

export const SITE = "https://forks.world";

export type LibItem = { id: string; title: string; authorName: string; tags: string[]; stepCount: number; likes: number; publishedAt: Date; updatedAt: Date };

/** Every public process, light (no map data), for the crawlable library and topic pages. */
export async function libraryItems(): Promise<LibItem[]> {
  return prisma.publicProcess.findMany({
    orderBy: [{ likes: "desc" }, { publishedAt: "desc" }], take: 2000,
    select: { id: true, title: true, authorName: true, tags: true, stepCount: true, likes: true, publishedAt: true, updatedAt: true },
  }).catch(() => []);
}

export const slugOf = (tag: string) => tag.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const niceTag = (tag: string) => tag.replace(/\b\w/g, c => c.toUpperCase());

/** Tags with how many processes use them, most used first. */
export function tagCounts(items: LibItem[]): { tag: string; slug: string; n: number }[] {
  const c = new Map<string, number>();
  items.forEach(i => i.tags.forEach(t => c.set(t, (c.get(t) || 0) + 1)));
  return [...c.entries()].map(([tag, n]) => ({ tag, slug: slugOf(tag), n })).filter(t => t.slug).sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag));
}
