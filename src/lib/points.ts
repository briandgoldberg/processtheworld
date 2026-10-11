import { prisma } from "./db";

// Everyone starts with 100 credits. One credit is used each time the built in
// AI helper answers a message while you map a process. Using your own Claude or
// ChatGPT (the connector, skill or API) never uses credits. Stored in User.points.
export const START_CREDITS = 100;
export const LOW_CREDITS = 20; // 20 credits or fewer counts as low

/** Use credits. Never throws. */
export async function spendCredit(userId: string, credits: number, refId: string) {
  if (!(credits > 0)) return;
  await prisma.$transaction([
    prisma.pointEvent.create({ data: { userId, delta: -credits, reason: "ai", refId } }),
    prisma.user.update({ where: { id: userId }, data: { points: { decrement: credits } } }),
  ]).catch(err => console.error("spend failed", err));
}

// Community processes: credits are earned for helping, never for volume alone.
// A suggestion earns nothing until other people agree and it goes live.
export const EARN = {
  validate: { credits: 2, label: "Confirmed a community process matches your experience" },
  vote: { credits: 2, label: "Voted on a suggested change", dailyCap: 20 },
  accepted: { credits: 20, label: "A change you suggested went live" },
} as const;
export type Earn = keyof typeof EARN;

/** Give credits once per (kind, refId), within any daily cap. Returns the credits given (0 if already given or capped). Never throws. */
export async function earnCredits(userId: string, kind: Earn, refId: string): Promise<number> {
  const r: { credits: number; dailyCap?: number } = EARN[kind];
  try {
    if (r.dailyCap) {
      const since = new Date(Date.now() - 864e5);
      const agg = await prisma.pointEvent.aggregate({ where: { userId, reason: kind, createdAt: { gte: since } }, _sum: { delta: true } });
      if ((agg._sum.delta || 0) + r.credits > r.dailyCap) return 0;
    }
    await prisma.$transaction([
      prisma.pointEvent.create({ data: { userId, delta: r.credits, reason: kind, refId } }),
      prisma.user.update({ where: { id: userId }, data: { points: { increment: r.credits } } }),
    ]);
    return r.credits;
  } catch {
    return 0; // unique (userId, reason, refId): already given
  }
}
