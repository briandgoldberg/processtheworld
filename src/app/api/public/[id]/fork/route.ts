import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { award } from "@/lib/points";

export const dynamic = "force-dynamic";

// Make your own private copy of a public process (for agents and scripts; the app does this in the browser).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Send your agent key in the x-ptw-key header.", 401);
  const pub = await prisma.publicProcess.findUnique({ where: { id } });
  if (!pub) return fail("Not found.", 404);
  const doc = pub.doc as any;
  const pid = "p_" + randomBytes(9).toString("hex");
  await prisma.process.create({ data: { id: pid, userId: user.id, title: pub.title, status: "done", doc: { ...doc, chat: [], events: [], forkedFrom: id } as any, stepCount: pub.stepCount, depth: pub.depth, laneTypes: pub.laneTypes, forkedFrom: id } });
  await prisma.publicProcess.update({ where: { id }, data: { copies: { increment: 1 } } });
  if (pub.userId !== user.id) await award(pub.userId, "copy", `${id}:${user.id}`);
  return json({ ok: true, id: pid });
}
