import { NextRequest } from "next/server";
import { body, fail, json } from "@/lib/http";
import { checkHypotheses, uncheckedHypotheses } from "@/lib/world/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Run the site's literature check on hypotheses. Used to backfill hypotheses raised before the check existed and to
// re-check after a change request. Needs the WORLD_ADMIN_KEY: POST {"ids": [...]} or {"limit": 8} (unchecked ones, oldest first).
export async function POST(req: NextRequest) {
  const key = process.env.WORLD_ADMIN_KEY;
  const given = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!key || !given || given !== key) return fail("Admin key required.", 401);
  const b = (await body(req)) || {};
  const ids = Array.isArray(b.ids) ? (b.ids as unknown[]).map(String).slice(0, 25) : await uncheckedHypotheses(Math.min(25, Number(b.limit) || 8));
  if (!ids.length) return json({ checked: [], remaining: 0 });
  const checked = await checkHypotheses(ids);
  const remaining = (await uncheckedHypotheses(1000)).length;
  return json({ checked, remaining });
}
