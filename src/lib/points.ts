import { prisma } from "./db";

// Points are the currency of the tool. One point is one cent of AI usage, and
// everyone starts with 100 (about $1). Using the mapper spends points at what
// the AI call actually cost; contributing earns them back.
export const POINT_USD = 0.01;

export const REWARDS = {
  publish: { points: 25, label: "Published a process" },
  accepted: { points: 20, label: "A change you suggested went live" },
  vote: { points: 2, label: "Voted on a suggested change", dailyCap: 20 },
  copy: { points: 3, label: "Someone copied your public process" },
  feedback: { points: 2, label: "Gave feedback", dailyCap: 10 },
} as const;
export type Reward = keyof typeof REWARDS;

/** Spend points for an AI call. Never throws; the balance may dip slightly below zero on the last call. */
export async function spend(userId: string, costUsd: number, refId: string) {
  const points = costUsd / POINT_USD;
  if (!(points > 0)) return;
  await prisma.$transaction([
    prisma.pointEvent.create({ data: { userId, delta: -points, reason: "ai", refId } }),
    prisma.user.update({ where: { id: userId }, data: { points: { decrement: points } } }),
  ]).catch(err => console.error("spend failed", err));
}

/** Give points once per (reason, refId). Returns the points awarded, or 0 if already awarded or capped. */
export async function award(userId: string, reward: Reward, refId: string) {
  const r: { points: number; dailyCap?: number } = REWARDS[reward];
  try {
    if (r.dailyCap) {
      const since = new Date(Date.now() - 864e5);
      const agg = await prisma.pointEvent.aggregate({ where: { userId, reason: reward, createdAt: { gte: since } }, _sum: { delta: true } });
      if ((agg._sum.delta || 0) + r.points > r.dailyCap) return 0;
    }
    await prisma.$transaction([
      prisma.pointEvent.create({ data: { userId, delta: r.points, reason: reward, refId } }),
      prisma.user.update({ where: { id: userId }, data: { points: { increment: r.points } } }),
    ]);
    return r.points;
  } catch {
    return 0; // unique (userId, reason, refId): already awarded
  }
}
