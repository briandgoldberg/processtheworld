import type { Metadata } from "next";
import Link from "next/link";
import AskBox from "@/components/AskBox";

export const metadata: Metadata = { title: "Ask the map", description: "Ask how one part of the Earth system affects another and get an answer traced line by line through the map, with the papers behind each line." };

// Ask: a question becomes a search over the map's cited lines; the answer names each line it rests on.
export default function AskPage() {
  return (
    <div className="wrap" style={{ paddingTop: 24, maxWidth: 860 }}>
      <h1 style={{ fontSize: "clamp(28px,4.5vw,44px)" }}>Ask the map</h1>
      <p className="muted" style={{ maxWidth: "70ch" }}>Ask how one thing affects another. The answer is traced through the map&apos;s lines, each with its direction, size and papers, and it says so when the map has no path. For a single step&apos;s downstream effects, use <Link href="/impact">Impact</Link>.</p>
      <div style={{ marginTop: 18 }}><AskBox /></div>
    </div>
  );
}
