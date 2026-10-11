import Studio from "./Studio";
import { libraryItems, tagCounts, niceTag } from "@/lib/library";

export const revalidate = 3600;

export default async function Home() {
  const items = await libraryItems();
  const tags = tagCounts(items).slice(0, 24);
  return (
    <>
      {/* Plain links for search engines and AI tools: the app below loads with JavaScript */}
      <nav className="seo-only" aria-label="Process map library">
        <h1>forks.world: mapping how the world works</h1>
        <p>A library of swim-lane process maps. <a href="/library">Browse all {items.length} process maps</a> or <a href="/connect">connect Claude or ChatGPT</a> to make your own.</p>
        <ul>{tags.map(t => <li key={t.slug}><a href={`/topics/${t.slug}`}>{niceTag(t.tag)} process maps</a></li>)}</ul>
        <ul>{items.slice(0, 40).map(p => <li key={p.id}><a href={`/p/${p.id}`}>{p.title}</a></li>)}</ul>
      </nav>
      <Studio />
    </>
  );
}
