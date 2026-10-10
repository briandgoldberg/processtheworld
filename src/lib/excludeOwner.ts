import { prisma } from "./db";

// The dashboard is about everyone else. The owner's own activity (the account named Brian, and the admin
// account) is left out of every number and list, so testing and the starter library don't count.
export async function ownerIds(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { OR: [{ handle: { equals: "Brian", mode: "insensitive" } }, { email: "briandgoldberg@gmail.com" }] },
    select: { id: true },
  });
  return rows.map(r => r.id);
}
