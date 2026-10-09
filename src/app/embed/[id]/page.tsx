import Studio from "../../Studio";

export const dynamic = "force-dynamic";

// A process map you can drop into any web page with an iframe.
export default async function Embed({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Studio open={id} embed />;
}
