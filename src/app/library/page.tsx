import type { Metadata } from "next";
import { libraryItems, tagCounts, niceTag, SITE } from "@/lib/library";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Process map library: how things work, step by step",
  description: "Browse every public process map on forks.world: science, technology, business, history and daily life, each as a clear swim-lane map you can walk through, copy and build on.",
  alternates: { canonical: "/library" },
};

// A plain, fast page that lists every public process with a real link, so search engines and AI tools can find them all.
export default async function Library() {
  const items = await libraryItems();
  const tags = tagCounts(items);
  const ld = {
    "@context": "https://schema.org", "@type": "CollectionPage", name: "Process map library", url: `${SITE}/library`,
    mainEntity: { "@type": "ItemList", numberOfItems: items.length, itemListElement: items.slice(0, 200).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/p/${p.id}`, name: p.title })) },
  };
  return (
    <main className="lib">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <p><a href="/">forks.world</a> · <a href="/connect">Connect my AI</a> · <a href="/privacy">Privacy</a></p>
      <h1>Process map library</h1>
      <p className="lib-sub">{items.length} public process maps showing how the world works. Open one to walk through it step by step.</p>
      <h2>Browse by topic</h2>
      <p className="lib-tags">{tags.slice(0, 60).map(t => <a key={t.slug} href={`/topics/${t.slug}`}>{niceTag(t.tag)} <small>{t.n}</small></a>)}</p>
      <h2>All processes</h2>
      <ul className="lib-list">
        {items.map(p => (
          <li key={p.id}>
            <a href={`/p/${p.id}`}>{p.title}</a>
            <span> {p.stepCount} steps{p.tags.length ? ` · ${p.tags.slice(0, 3).join(", ")}` : ""}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
