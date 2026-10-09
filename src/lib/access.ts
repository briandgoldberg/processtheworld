import { prisma } from "./db";

export type Role = "owner" | "edit" | "view";

/** What this user may do with a process: owner, edit, view, or nothing. */
export async function accessTo(processId: string, userId: string) {
  const process = await prisma.process.findUnique({ where: { id: processId } });
  if (!process) return { process: null, role: null as Role | null };
  if (process.userId === userId) return { process, role: "owner" as Role };
  const share = await prisma.share.findFirst({ where: { processId, userId, acceptedAt: { not: null } }, select: { role: true } });
  return { process, role: (share ? (share.role === "view" ? "view" : "edit") : null) as Role | null };
}
export const canEdit = (r: Role | null) => r === "owner" || r === "edit";
