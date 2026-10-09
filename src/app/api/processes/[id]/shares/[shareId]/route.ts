import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, json } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { accessTo } from "@/lib/access";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; shareId: string }> };

// The owner removes someone (or a pending invite); anyone can remove themselves.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id, shareId } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const share = await prisma.share.findUnique({ where: { id: shareId } });
  if (!share || share.processId !== id) return json({ ok: true });
  const { role } = await accessTo(id, user.id);
  if (role !== "owner" && share.userId !== user.id) return fail("Only the owner can remove people.", 403);
  await prisma.share.delete({ where: { id: shareId } });
  return json({ ok: true });
}

// The owner changes someone's role.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id, shareId } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  const { role } = await accessTo(id, user.id);
  if (role !== "owner") return fail("Only the owner can change roles.", 403);
  const b = await body(req);
  await prisma.share.updateMany({ where: { id: shareId, processId: id }, data: { role: b?.role === "view" ? "view" : "edit" } });
  return json({ ok: true });
}
