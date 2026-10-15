import { mapPage, processIds } from "@/lib/test/mapPage";

export const dynamic = "force-static";
export const dynamicParams = false;
export const generateStaticParams = () => processIds().map(id => ({ id }));

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return mapPage(id) ?? new Response("Not found", { status: 404 });
}
