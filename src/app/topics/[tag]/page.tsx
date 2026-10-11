import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { libraryItems, tagCounts, niceTag, slugOf, SITE } from "@/lib/library";

export const revalidate = 3600;
type Props = { params: Promise<{ tag: string }> };

async function load(slug: string) {
  const items = await libraryItems();
  const tag = tagCounts(items).find(t => t.slug === slug);
  return tag ? { tag, list: items.filter(i => i.tags.some(t => slugOf(t) === slug)), all: tagCounts(items) } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag: slug } = await params;
  const d = await load(slug);
  if (!d) return {};
  const name = niceTag(d.tag.tag);
  return {
    title: `${name} process maps`,
    description: `${d.list.length} step-by-step ${name.toLowerCase()} process maps: ${d.list.slice(0, 3).map(p => p.title).join("; ")}. Walk through each one, copy it, and build on it.`,
    alternates: { canonical: `/topics/${slug}` },
  };
}

export default async function Topic({ params }: Props) {
  const { tag: slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  const name = niceTag(d.tag.tag);
  const ld = {
    "@context": "https://schema.org", "@type": "CollectionPage", name: `${name} process maps`, url: `${SITE}/topics/${slug}`,
    mainEntity: { "@type": "ItemList", numberOfItems: d.list.length, itemListElement: d.list.slice(0, 100).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/p/${p.id}`, name: p.title })) },
  };
  return (
    <main className="lib">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <p><a href="/">forks.world</a> · <a href="/library">All processes</a></p>
      <h1>{name} process maps</h1>
      <p className="lib-sub">{d.list.length} public process map{d.list.length === 1 ? "" : "s"} tagged {d.tag.tag}.</p>
      <ul className="lib-list">
        {d.list.map(p => (
          <li key={p.id}>
            <a href={`/p/${p.id}`}>{p.title}</a>
            <span> {p.stepCount} steps</span>
          </li>
        ))}
      </ul>
      <h2>More topics</h2>
      <p className="lib-tags">{d.all.filter(t => t.slug !== slug).slice(0, 30).map(t => <a key={t.slug} href={`/topics/${t.slug}`}>{niceTag(t.tag)} <small>{t.n}</small></a>)}</p>
    </main>
  );
}
