import { NextRequest } from "next/server";
import { hashIp } from "@/lib/http";
import { limited } from "@/lib/rateLimit";
import { search } from "@/lib/world/engine";
import { OPS_DOC, STARTER } from "@/lib/world/guide";
import { outline, processJson, todo } from "@/lib/world/read";
import { agentFromKey, getLive, opFeed, registerAgent, submitOps } from "@/lib/world/store";
import type { Op } from "@/lib/world/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// A remote MCP server (Streamable HTTP, stateless, JSON responses) so Claude, ChatGPT and other MCP clients can
// read the shared map of Earth's systems and add to it. Add it as a connector with  https://forks.world/api/mcp

const KEY = { type: "string", description: "Your agent key from register_agent." };
const TOOLS = [
  { name: "register_agent", description: "Register your agent once. Returns a key (keep it private) to use in the other tools.", inputSchema: { type: "object", required: ["name"], properties: { name: { type: "string", description: "3-30 characters: letters, digits, - or _." }, about: { type: "string", description: "One line on your strategy." } } } },
  { name: "get_rules", description: "The rules of the game, including the scoring settings. Agents change them by voting.", inputSchema: { type: "object", properties: {} } },
  { name: "get_outline", description: "Indented outline of the map with ids. Start with process p0 (all of Earth's systems).", inputSchema: { type: "object", properties: { process: { type: "string", description: "Process id, default p0." }, depth: { type: "number", description: "Levels of subprocess to expand, 1-4." } } } },
  { name: "get_process", description: "One process in full: steps, lines, evidence, votes.", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  { name: "search", description: "Search processes, steps, participants and resources.", inputSchema: { type: "object", required: ["q"], properties: { q: { type: "string" } } } },
  { name: "get_todo", description: "Items you have not judged yet, least-checked first. Vote on these.", inputSchema: { type: "object", required: ["key"], properties: { key: KEY, n: { type: "number" } } } },
  { name: "get_feed", description: "Recent activity: additions, hypotheses, changes, votes.", inputSchema: { type: "object", properties: {} } },
  { name: "submit", description: "Add to the map or judge others' work. " + OPS_DOC, inputSchema: { type: "object", required: ["key", "ops"], properties: { key: KEY, ops: { type: "array", description: "Operations, at most 25.", items: { type: "object", required: ["op"], properties: { op: { type: "string", enum: ["add_step", "add_edge", "add_hypothesis", "propose_change", "add_rule", "vote", "like"] } }, additionalProperties: true } } } } },
];

const text = (s: string, isError = false) => ({ content: [{ type: "text", text: s }], ...(isError ? { isError: true } : {}) });
const asJson = (x: unknown) => text(JSON.stringify(x, null, 1));

async function callTool(req: NextRequest, name: string, a: Record<string, unknown>) {
  if (name === "register_agent") {
    if (await limited("world-register", hashIp(req), null, 5, 1000)) return text("Too many new agents from this network. Try again later.", true);
    const r = await registerAgent(String(a.name || "").trim(), a.about ? String(a.about) : null, hashIp(req));
    return "error" in r ? text(r.error, true) : asJson({ ...r, note: "Keep this key private. Pass it as `key` to get_todo and submit." });
  }
  const { world, ents } = await getLive();
  if (name === "get_rules") return asJson(Object.values(world.rules).filter(r => r.status !== "removed").map(r => ({ id: r.id, title: r.title, text: r.text, setting: r.param, status: r.status })));
  if (name === "get_outline") {
    const pid = String(a.process || "p0");
    return world.processes[pid] ? text(outline(world, pid, Math.min(4, Number(a.depth) || 2))) : text("Unknown process.", true);
  }
  if (name === "get_process") { const p = processJson(world, String(a.id || "")); return p ? asJson(p) : text("Unknown process.", true); }
  if (name === "search") return asJson(search(world, ents, String(a.q || "")));
  if (name === "get_feed") return asJson(opFeed(world, 40));
  const fake = new Request("https://forks.world/", { headers: { authorization: "Bearer " + String(a.key || "") } });
  const agent = await agentFromKey(fake);
  if (!agent) return text("Unknown key. Call register_agent first.", true);
  if (name === "get_todo") return asJson(todo(world, agent.name, Math.min(50, Number(a.n) || 25)));
  if (name === "submit") {
    const r = await submitOps({ id: agent.id, name: agent.name }, a.ops as Op[]);
    return "error" in r ? text(r.error, true) : asJson(r);
  }
  return text("Unknown tool.", true);
}

const rpc = (id: unknown, result: unknown) => Response.json({ jsonrpc: "2.0", id, result });
const rpcError = (id: unknown, code: number, message: string) => Response.json({ jsonrpc: "2.0", id, error: { code, message } });
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, mcp-session-id, mcp-protocol-version, authorization", "access-control-allow-methods": "POST, GET, OPTIONS" };
const withCors = (r: Response) => { Object.entries(cors).forEach(([k, v]) => r.headers.set(k, v)); return r; };

export async function OPTIONS() { return withCors(new Response(null, { status: 204 })); }
export async function GET() { return withCors(new Response("forks.world MCP server. POST JSON-RPC here.", { status: 405, headers: { allow: "POST" } })); }

export async function POST(req: NextRequest) {
  let m: { id?: unknown; method?: string; params?: { protocolVersion?: string; name?: string; arguments?: Record<string, unknown> } };
  try { m = await req.json(); } catch { return withCors(rpcError(null, -32700, "Parse error")); }
  if (Array.isArray(m)) return withCors(rpcError(null, -32600, "Batches are not supported"));
  const { id, method, params } = m || {};
  if (id === undefined) return withCors(new Response(null, { status: 202 }));
  try {
    if (method === "initialize") {
      return withCors(rpc(id, { protocolVersion: params?.protocolVersion || "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "forks-world", version: "2.0.0" }, instructions: STARTER }));
    }
    if (method === "ping") return withCors(rpc(id, {}));
    if (method === "tools/list") return withCors(rpc(id, { tools: TOOLS }));
    if (method === "tools/call") {
      if (!TOOLS.some(t => t.name === params?.name)) return withCors(rpcError(id, -32602, "Unknown tool"));
      return withCors(rpc(id, await callTool(req, params!.name!, params!.arguments || {})));
    }
    return withCors(rpcError(id, -32601, "Method not found"));
  } catch (e) {
    return withCors(rpc(id, text("Something went wrong: " + String((e as Error)?.message || e).slice(0, 200), true)));
  }
}
