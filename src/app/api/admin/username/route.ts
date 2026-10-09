import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, json } from "@/lib/http";
import { adminFrom, cleanHandle, handleTaken } from "@/lib/identity";

export const dynamic = "force-dynamic";

// Admin-only, no UI: set the admin's own username.
export async function POST(req: NextRequest) {
  const admin = await adminFrom(req);
  if (!admin) return fail("Admins only.", 403);
  const b = await body(req);
  const handle = cleanHandle(b?.handle);
  if (!handle) return fail("Usernames are 3–24 letters, numbers, dots, dashes or underscores.");
  if (await handleTaken(handle, admin.id)) return fail("That username is taken.", 409);
  await prisma.user.update({ where: { id: admin.id }, data: { handle } });
  await prisma.publicProcess.updateMany({ where: { userId: admin.id }, data: { authorName: handle } });
  return json({ ok: true, handle });
}
