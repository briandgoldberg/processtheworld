import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, json } from "@/lib/http";
import { userFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";

// Build together: the owner lets anyone with the link join as an editor (or turns it back off).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const p = await prisma.process.findUnique({ where: { id }, include: { public: { select: { id: true } } } });
  if (!p || p.userId !== user.id) return fail("Not found.", 404);
  if (p.public) return fail("Public processes cannot be changed, so they cannot be opened for editing.", 409);
  const b = await body(req);
  const on = b?.on === true;
  await prisma.process.update({ where: { id }, data: { openEdit: on } });
  return json({ ok: true, openEdit: on });
}
