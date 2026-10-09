import { prisma } from "./db";

// Counts recent requests for an endpoint by hashed IP and by user. Fails open
// when the caller can't be identified, like WaitingForPower's limiter.
export async function limited(endpoint: string, ipHash: string | null, userId: string | null, perHourIp: number, perDayUser: number): Promise<boolean> {
  const hour = new Date(Date.now() - 60 * 60 * 1000);
  const day = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [byIp, byUser] = await Promise.all([
    ipHash ? prisma.requestLog.count({ where: { endpoint, ipHash, createdAt: { gte: hour } } }) : 0,
    userId ? prisma.requestLog.count({ where: { endpoint, userId, createdAt: { gte: day } } }) : 0,
  ]);
  if (byIp >= perHourIp || byUser >= perDayUser) return true;
  await prisma.requestLog.create({ data: { endpoint, ipHash, userId } });
  return false;
}
