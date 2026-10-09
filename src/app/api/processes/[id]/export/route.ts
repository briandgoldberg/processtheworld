import { NextRequest } from "next/server";
import { fail } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { accessTo } from "@/lib/access";
import { renderDoc } from "@/lib/render";

export const dynamic = "force-dynamic";

// One of your processes (or one shared with you) as a Markdown file any AI can read in full.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Send your agent key in the x-ptw-key header.", 401);
  const { process: p, role } = await accessTo(id, user.id);
  if (!p || !role) return fail("Not found.", 404);
  return renderDoc(p.doc, req.nextUrl.searchParams.get("format"));
}
