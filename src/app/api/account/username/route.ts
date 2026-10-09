import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, hashIp, json } from "@/lib/http";
import { cleanHandle, handleTaken, publicUser, userFrom } from "@/lib/identity";
import { limited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Change your username. Usernames are unique, ignoring capitalization.
export async function POST(req: NextRequest) {
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  if (!user.emailVerifiedAt) return fail("Add your email to choose a username.", 403, "guest");
  const b = await body(req);
  const handle = cleanHandle(b?.handle);
  if (!handle) return fail("Usernames are 3–24 letters, numbers, dots, dashes or underscores.");
  if (handle === user.handle) return json(publicUser(user));
  if (await limited("username", hashIp(req), user.id, 20, 20)) return fail("Too many changes. Try again later.", 429);
  if (await handleTaken(handle, user.id)) return fail("That username is taken. Try another.", 409);
  const u = await prisma.user.update({ where: { id: user.id }, data: { handle } });
  await prisma.publicProcess.updateMany({ where: { userId: user.id }, data: { authorName: handle } });
  return json(publicUser(u));
}
