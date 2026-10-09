import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [versions, decided] = await Promise.all([
    prisma.publicVersion.findMany({ where: { publicId: id }, orderBy: { version: "desc" }, take: 50, select: { version: true, title: true, proposalId: true, createdAt: true } }),
    prisma.proposal.findMany({ where: { publicId: id, status: { in: ["accepted", "rejected"] } }, orderBy: { decidedAt: "desc" }, take: 50, select: { id: true, note: true, status: true, decidedAt: true, author: { select: { handle: true } } } }),
  ]);
  return json({ versions, decided: decided.map(d => ({ ...d, author: d.author.handle })) });
}
