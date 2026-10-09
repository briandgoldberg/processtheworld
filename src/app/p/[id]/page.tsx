import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import Studio from "../../Studio";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

// A public process's own link: what X and other sites show when it's shared.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const r = await prisma.publicProcess.findUnique({ where: { id }, select: { title: true, authorName: true, stepCount: true } }).catch(() => null);
  if (!r) return {};
  const title = `${r.title} | Process the World`;
  const description = `A ${r.stepCount}-step process map by ${r.authorName}. Improve it or build your own.`;
  return { title, description, openGraph: { title, description, type: "website" }, twitter: { card: "summary_large_image", title, description } };
}

export default async function PublicProcessPage({ params }: Props) {
  const { id } = await params;
  return <Studio open={id} />;
}
