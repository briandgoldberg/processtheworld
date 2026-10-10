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
