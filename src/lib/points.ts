import { prisma } from "./db";

// Everyone gets about $1 of AI usage in total. The balance is stored in
// cents (User.points, default 100) and goes down by what each AI call
// actually cost. At zero the person is paused until more is granted.
export const CREDIT_USD = 0.01; // one unit is one cent
export const LOW_CREDITS = 25; // 25 cents or less left counts as low

/** Take what an AI call cost off the balance. Never throws; the last call may dip slightly below zero. */
export async function spend(userId: string, costUsd: number, refId: string) {
  const units = costUsd / CREDIT_USD;
  if (!(units > 0)) return;
  await prisma.$transaction([
    prisma.pointEvent.create({ data: { userId, delta: -units, reason: "ai", refId } }),
    prisma.user.update({ where: { id: userId }, data: { points: { decrement: units } } }),
  ]).catch(err => console.error("spend failed", err));
}
