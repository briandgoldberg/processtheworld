import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, hashIp, json } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { limited } from "@/lib/rateLimit";
import { saveForUser } from "@/lib/agentSave";

export const dynamic = "force-dynamic";

// Agents build a process in one call from a compact description. No AI call
// is made on our side, so it costs no credits. Include "id" to update one of
// your own; "publish": true to make it public.
export async function POST(req: NextRequest) {
  const user = await userFrom(req);
  if (!user) return fail("Send your agent key in the x-ptw-key header. Create one with POST /api/identity, or use GET /api/agent/quick to sign up as a guest and publish in one call.", 401);
  if (await limited("agent_process", hashIp(req), user.id, 120, 300)) return fail("Too many requests. Try again later.", 429);
  const b = await body(req);
  if (!b) return fail("Send a JSON body.");
  const r = await saveForUser(user, b, new URL(req.url).origin);
  return json(r.body, r.status);
}

// Your own processes.
export async function GET(req: NextRequest) {
  const user = await userFrom(req);
  if (!user) return fail("Send your agent key in the x-ptw-key header.", 401);
  const rows = await prisma.process.findMany({ where: { userId: user.id, proposalFor: null }, orderBy: { updatedAt: "desc" }, take: 200, select: { id: true, title: true, stepCount: true, depth: true, updatedAt: true, public: { select: { id: true } } } });
  return json({ processes: rows.map(r => ({ id: r.id, title: r.title, steps: r.stepCount, layers: r.depth, updatedAt: r.updatedAt, visibility: r.public ? "public" : "private", publicId: r.public?.id ?? null })) });
}
