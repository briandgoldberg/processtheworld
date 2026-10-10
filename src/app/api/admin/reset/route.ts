import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, json } from "@/lib/http";
import { adminFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Start the dashboard over. "analytics" clears what the dashboard is built from (usage events, interview turns,
// AI call logs, feedback, suggestions, request logs). "guests" removes guest accounts that never made anything.
// Nobody's processes, the public library, email members, credits balances and early-access emails are kept.
const emptyGuests = (adminId: string) => ({
  id: { not: adminId }, email: null, emailVerifiedAt: null,
  processes: { none: {} }, published: { none: {} }, shares: { none: {} }, comments: { none: {} }, likes: { none: {} },
});

export async function GET(req: NextRequest) {
  const admin = await adminFrom(req);
  if (!admin) return fail("Admins only.", 403);
  const [events, turns, aiCalls, feedback, suggestions, requests, guests] = await Promise.all([
    prisma.event.count(), prisma.turn.count(), prisma.aiCall.count(), prisma.feedback.count(), prisma.suggestion.count(), prisma.requestLog.count(),
    prisma.user.count({ where: emptyGuests(admin.id) }),
  ]);
  return json({ events, turns, aiCalls, feedback, suggestions, requests, guests });
}

export async function POST(req: NextRequest) {
  const admin = await adminFrom(req);
  if (!admin) return fail("Admins only.", 403);
  const b = await body(req);
  if (b?.what === "analytics") {
    // Turns first: it takes the AI changes and interview questions with it
    const [turns, events, aiCalls, feedback, suggestions, requests] = await prisma.$transaction([
      prisma.turn.deleteMany({}), prisma.event.deleteMany({}), prisma.aiCall.deleteMany({}),
      prisma.feedback.deleteMany({}), prisma.suggestion.deleteMany({}), prisma.requestLog.deleteMany({}),
    ]);
    return json({ ok: true, removed: { turns: turns.count, events: events.count, aiCalls: aiCalls.count, feedback: feedback.count, suggestions: suggestions.count, requests: requests.count } });
  }
  if (b?.what === "guests") {
    const r = await prisma.user.deleteMany({ where: emptyGuests(admin.id) });
    return json({ ok: true, removed: { guests: r.count } });
  }
  return fail("Say what to clear: analytics or guests.");
}
