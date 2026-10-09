import { NextRequest } from "next/server";
import { body, fail, hashIp } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { accessTo, canEdit } from "@/lib/access";
import { limited } from "@/lib/rateLimit";
import { mapPrompt, repairPrompt } from "@/lib/engine/prompts";
import { mapModel, streamAndLog } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// The only way the browser reaches Claude. The client sends the map and the
// conversation; the server owns the instructions, picks the model, streams the
// reply and records the call.
export async function POST(req: NextRequest) {
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  if (!process.env.ANTHROPIC_API_KEY) return fail("The mapper isn't configured yet.", 503, "not_configured");
  const b = await body(req);
  if (!b) return fail("Invalid request body.");
  if (await limited("ai", hashIp(req), user.id, 120, 600)) return fail("Too many requests right now. Wait a moment, then send again.", 429, "rate_limited");

  const mode = b.mode === "repair" ? "repair" : "map";
  const processId = typeof b.processId === "string" ? b.processId.slice(0, 64) : null;
  if (processId) {
    const { process: p, role } = await accessTo(processId, user.id);
    if (p && !canEdit(role)) return fail("You can view this process but not edit it.", 403);
  }
  const { system, text } = mode === "repair" ? repairPrompt(b) : mapPrompt(b);
  const { id, stream } = await streamAndLog({ userId: user.id, processId, mode, model: mapModel() }, system, text);
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-ai-call-id": id } });
}
