import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { prisma } from "./db";
import { ENGINE_VERSION } from "./engine/prompts";
import { spend } from "./points";

// USD per million tokens: [input, output, cache read, cache write (5 min)].
// Source: platform.claude.com/docs/en/about-claude/pricing (checked 2026-10-08).
const PRICES: Record<string, [number, number, number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5, 0.01, 0.125],
  "claude-sonnet-5-5": [2, 10, 0.1, 2.5],
  "claude-opus-5-5": [4, 20, 0.2, 5],
};
export function costOf(model: string, u: { input: number; output: number; cacheRead: number; cacheWrite: number }) {
  const p = PRICES[model] || PRICES["claude-haiku-5-5"];
  return (u.input * p[0] + u.output * p[1] + u.cacheRead * p[2] + u.cacheWrite * p[3]) / 1e6;
}

export const mapModel = () => process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
export const analysisModel = () => process.env.ANALYSIS_MODEL || "claude-sonnet-5-5";

let client: Anthropic | null = null;
const anthropic = () => (client ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

type CallMeta = { userId: string | null; processId: string | null; mode: string; model: string };

/** Stream a reply as plain text, and record the whole call when it ends. */
export async function streamAndLog(meta: CallMeta, system: string, text: string, maxTokens = 4000) {
  const row = await prisma.aiCall.create({
    data: {
      userId: meta.userId, processId: meta.processId, mode: meta.mode, model: meta.model, engineVersion: ENGINE_VERSION,
      promptHash: createHash("sha256").update(system).digest("hex").slice(0, 16), system: system.length > 20000 ? system.slice(0, 20000) : system, prompt: text,
    },
    select: { id: true },
  });
  const started = Date.now();
  let output = "";
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, stopReason: string | null = null, error: string | null = null;
      try {
        const s = anthropic().messages.stream({
          model: meta.model,
          max_tokens: maxTokens,
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: text }],
        });
        s.on("text", (delta: string) => { output += delta; controller.enqueue(encoder.encode(delta)); });
        const final = await s.finalMessage();
        stopReason = final.stop_reason ?? null;
        const u: any = final.usage || {};
        usage = { input: u.input_tokens || 0, output: u.output_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0 };
      } catch (e: any) {
        error = String(e?.message || e).slice(0, 500);
        controller.enqueue(encoder.encode("\n" + JSON.stringify({ op: "error", message: "The mapper is unavailable right now." }) + "\n"));
      } finally {
        controller.close();
        await prisma.aiCall.update({
          where: { id: row.id },
          data: { output, inputTokens: usage.input, outputTokens: usage.output, cacheRead: usage.cacheRead, cacheWrite: usage.cacheWrite, costUsd: costOf(meta.model, usage), latencyMs: Date.now() - started, stopReason, error },
        }).catch(err => console.error("aiCall log failed", err));
        if (meta.userId && meta.mode !== "suggest") await spend(meta.userId, costOf(meta.model, usage), row.id);
      }
    },
  });
  return { id: row.id, stream };
}

/** One non-streamed call that returns text (used for admin suggestions). */
export async function completeAndLog(meta: CallMeta, system: string, text: string, maxTokens = 3000) {
  const started = Date.now();
  const res = await anthropic().messages.create({ model: meta.model, max_tokens: maxTokens, system, messages: [{ role: "user", content: text }] });
  const out = res.content.map((c: any) => (c.type === "text" ? c.text : "")).join("");
  const u: any = res.usage || {};
  const usage = { input: u.input_tokens || 0, output: u.output_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0 };
  await prisma.aiCall.create({
    data: { userId: meta.userId, processId: meta.processId, mode: meta.mode, model: meta.model, engineVersion: ENGINE_VERSION, promptHash: createHash("sha256").update(system).digest("hex").slice(0, 16), system, prompt: text, output: out, inputTokens: usage.input, outputTokens: usage.output, cacheRead: usage.cacheRead, cacheWrite: usage.cacheWrite, costUsd: costOf(meta.model, usage), latencyMs: Date.now() - started, stopReason: res.stop_reason ?? null },
  });
  return out;
}
