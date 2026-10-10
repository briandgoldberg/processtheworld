import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { ordered } from "@/lib/exportMd";
import Studio from "../../Studio";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };
const SITE = "https://forks.world";

async function load(id: string) {
  return prisma.publicProcess.findUnique({ where: { id }, select: { title: true, authorName: true, stepCount: true, depth: true, tags: true, doc: true, hasThumb: true, publishedAt: true, updatedAt: true } }).catch(() => null);
}

// A public process's own link: what search engines, X and other sites show.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const r = await load(id);
  if (!r) return {};
  const description = `${r.title}: a ${r.stepCount}-step process map by ${r.authorName}${r.tags.length ? ` (${r.tags.join(", ")})` : ""}. Walk through it step by step, copy it, or build on it.`;
  return {
    title: r.title, description, keywords: [...r.tags, "process map", "swim lane"],
    alternates: { canonical: `/p/${id}`, types: { "text/markdown": `/api/public/${id}/export` } },
    openGraph: { type: "article", title: r.title, description, url: `/p/${id}`, publishedTime: r.publishedAt.toISOString(), modifiedTime: r.updatedAt.toISOString(), authors: [r.authorName], tags: r.tags },
    twitter: { card: "summary_large_image", title: r.title, description },
  };
}

export default async function PublicProcessPage({ params }: Props) {
  const { id } = await params;
  const r = await load(id);
  let ld: object | null = null, steps: { label: string; lane: string }[] = [];
  if (r) {
    const maps: any = (r.doc as any)?.maps || {}, root = maps.m_root || Object.values(maps)[0] as any;
    const lane = new Map<string, string>((root?.lanes || []).map((l: any) => [l.id, l.name]));
    steps = root ? ordered(root).slice(0, 40).map((s: any) => ({ label: s.label, lane: lane.get(s.lane) || "" })) : [];
    ld = {
      "@context": "https://schema.org", "@type": "HowTo", name: r.title, url: `${SITE}/p/${id}`,
      description: `A ${r.stepCount}-step process map: ${steps.slice(0, 4).map(s => s.label).join(", ")}...`,
      author: { "@type": "Person", name: r.authorName }, datePublished: r.publishedAt.toISOString(), dateModified: r.updatedAt.toISOString(),
      keywords: r.tags.join(", "), ...(r.hasThumb ? { image: `${SITE}/api/public/${id}/thumb` } : {}),
      step: steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.label, text: s.lane ? `${s.lane}: ${s.label}` : s.label })),
    };
  }
  return (
    <>
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />}
      {r && (
        // The same content the app shows, as plain text for search engines and AI crawlers.
        <article className="seo-only">
          <h1>{r.title}</h1>
          <p>Process map by {r.authorName}. {r.stepCount} steps, {r.depth} {r.depth === 1 ? "layer" : "layers"}. Tags: {r.tags.join(", ")}.</p>
          <ol>{steps.map((s, i) => <li key={i}>{s.lane ? `${s.lane}: ` : ""}{s.label}</li>)}</ol>
          <p><a href={`/api/public/${id}/export`}>Read this process as Markdown</a></p>
        </article>
      )}
      <Studio open={id} />
    </>
  );
}
