import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// TEMPORARY, one use: lets the site owner clear the old product's processes. Needs a one-time token that only
// the owner holds (this file stores only its hash). Removed right after use.
export const dynamic = "force-dynamic";
const HASH = "95df8625e5bedb387a543a8bc0107d3f523bb690ae2bfd6bede209b74cf9a6a9";
const authed = (req: NextRequest) => createHash("sha256").update(req.headers.get("x-token") || "").digest("hex") === HASH;
const gone = () => new Response("Not found", { status: 404 });

export async function GET(req: NextRequest) {
  if (!authed(req)) return gone();
  const [processes, published] = await Promise.all([prisma.process.count(), prisma.publicProcess.count()]);
  return Response.json({ processes, published });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return gone();
  let b: { confirm?: string } = {};
  try { b = await req.json(); } catch { /* none */ }
  if (b.confirm !== "delete all old processes") return Response.json({ error: 'Send {"confirm": "delete all old processes"}' }, { status: 400 });
  const r = await prisma.process.deleteMany({});
  return Response.json({ deleted: r.count });
}
