import { renderOg } from "@/lib/ogImage";

export const alt = "A process map on Process the World";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderOg(id);
}
