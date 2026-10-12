import type { Metadata } from "next";
import Studio from "../../Studio";

export const metadata: Metadata = { title: "Build together | forks.world", robots: { index: false } };

export default async function Build({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Studio build={id} />;
}
