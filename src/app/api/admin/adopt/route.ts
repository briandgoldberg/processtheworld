import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, json } from "@/lib/http";
import { adminFrom, cleanHandle, handleTaken } from "@/lib/identity";

export const dynamic = "force-dynamic";

// The guest accounts that built the starter library of processes. Admins can move
// everything those accounts made onto their own account (and name it).
const AGENT_HANDLES = ["SteadyMapmaker34", "BrightTinkerer61"];

export async function POST(req: NextRequest) {
  const admin = await adminFrom(req);
  if (!admin) return fail("Admins only.", 403);
  const b = await body(req);
  const name = cleanHandle(b?.handle) || admin.handle;
  if (name.toLowerCase() !== admin.handle.toLowerCase() && (await handleTaken(name, admin.id))) return fail(`The username "${name}" is taken.`, 409);
  if (name !== admin.handle) await prisma.user.update({ where: { id: admin.id }, data: { handle: name } });
  const agents = await prisma.user.findMany({ where: { handle: { in: AGENT_HANDLES }, id: { not: admin.id } }, select: { id: true } });
  const ids = agents.map(a => a.id);
  const procs = await prisma.process.updateMany({ where: { userId: { in: ids } }, data: { userId: admin.id } });
  const pubs = await prisma.publicProcess.updateMany({ where: { userId: { in: ids } }, data: { userId: admin.id } });
  await prisma.publicProcess.updateMany({ where: { userId: admin.id }, data: { authorName: name } });
  return json({ ok: true, name, processes: procs.count, published: pubs.count });
}
