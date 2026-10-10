import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashIp } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { limited } from "@/lib/rateLimit";
import { saveForUser } from "@/lib/agentSave";
import { newGuest } from "@/lib/guest";
import { renderDoc } from "@/lib/render";
import { accessTo } from "@/lib/access";
import { cleanTag } from "@/lib/tags";
import { combineForUser } from "@/lib/agentCombine";

export const dynamic = "force-dynamic";

// A remote MCP server (Streamable HTTP, stateless, JSON responses) so Claude,
// ChatGPT and other MCP clients can build, publish and read process maps with
// no key and no setup: the first save signs the agent up as a guest.
// Add it as a connector with the URL  https://processtheworld.vercel.app/api/mcp

const LANE = { type: "object", required: ["id", "name"], properties: { id: { type: "string", description: "Letters, digits, - or _, starting with a letter." }, name: { type: "string" }, type: { type: "string", enum: ["person", "system"], description: "person = a role or user type; system = software, device or tool." } } };
const STEP = {
  type: "object", required: ["id", "lane", "label"],
  properties: {
    id: { type: "string" }, lane: { type: "string", description: "Id of the lane that does this step." }, label: { type: "string", description: "2 to 5 words; a question for decisions." },
    kind: { type: "string", enum: ["start", "task", "decision", "subprocess", "end"] },
    pain: { description: "Mark this step as a pain point: where it hurts (slow, error-prone, manual, costly). A short note, or {level: 1-3, note}.", oneOf: [{ type: "string" }, { type: "object", properties: { level: { type: "integer", minimum: 1, maximum: 3 }, note: { type: "string" } } }] },
    link: { type: "string", description: "Id of another process: a published one (from list_public or an earlier publish), or one you saved (the id save_process returned). The step becomes a link to that whole process, so you can build bigger processes out of smaller ones." },
    uses: { type: "array", items: { type: "string" }, description: "Lane ids of tools used in this step." },
    next: { type: "array", description: "Where it goes next: step id strings, or {to, label} (label the answer for decisions).", items: { oneOf: [{ type: "string" }, { type: "object", required: ["to"], properties: { to: { type: "string" }, label: { type: "string" } } }] } },
  },
};

const TOOLS = [
  {
    name: "save_process",
    description: "Create or update a swim-lane process map and optionally publish it. No account needed: if you don't pass a key, a guest account is created and its key is returned (pass it back to update later). Every decision step needs one labeled arrow per outcome, including the 'no' path. Lanes are people/roles or systems; steps flow via next. Returns the id, and publicUrl when published.",
    inputSchema: {
      type: "object", required: ["title", "lanes", "steps"],
      properties: {
        key: { type: "string", description: "Account key from an earlier save_process call. Omit to sign up as a guest." },
        id: { type: "string", description: "Id of a private process you saved before, to update it. Public processes cannot be changed." },
        title: { type: "string" },
        thumbnailArt: { type: "object", properties: { emoji: { type: "string" }, hue: { type: "integer" } }, description: "A generated thumbnail for the preview card: a gradient with one big emoji, e.g. {emoji: \"🧬\", hue: 280}." },
        tags: { type: "array", items: { type: "string" }, description: "Up to 8 short lowercase tags (e.g. sales, science, daily life) so people can find it." },
        publish: { type: "boolean", description: "true to publish it to everyone (a shareable link is returned)." },
        lanes: { type: "array", items: LANE }, steps: { type: "array", items: STEP },
        layers: { type: "array", description: "Detail maps that open from a step.", items: { type: "object", required: ["id", "parentStep", "lanes", "steps"], properties: { id: { type: "string" }, title: { type: "string" }, parentStep: { type: "string" }, parentLayer: { type: "string" }, lanes: { type: "array", items: LANE }, steps: { type: "array", items: STEP } } } },
      },
    },
  },
  {
    name: "list_public",
    description: "List published processes (title, author, tags, steps, likes, id). Search with q, or filter by one tag. Look here FIRST: if a process you need already exists, link it into yours (a step's link field) or combine it, instead of redrawing it.",
    inputSchema: { type: "object", properties: { q: { type: "string", description: "Search title, author or tag." }, tag: { type: "string" } } },
  },
  {
    name: "add_comment",
    description: "Comment on a published process, optionally pinned to a step. Like save_process, it signs you up as a guest if you pass no key.",
    inputSchema: { type: "object", required: ["public_id", "body"], properties: { public_id: { type: "string" }, body: { type: "string", description: "Up to 1000 characters." }, step: { type: "string", description: "Optional step to pin it to, as mapId|stepId (m_root|s1)." }, key: { type: "string" } } },
  },
  {
    name: "combine_processes",
    description: "Build a bigger process out of existing ones, like a person does on the site. Pass the ids of two or more published processes (find them with list_public) in order; you get a new process whose steps link to each part. Optionally publish it. Use this, or links inside save_process, instead of redrawing something that already exists.",
    inputSchema: { type: "object", required: ["parts"], properties: { title: { type: "string" }, parts: { type: "array", items: { oneOf: [{ type: "string" }, { type: "object", required: ["id"], properties: { id: { type: "string" }, label: { type: "string" } } }] }, description: "Published process ids, in order (or {id, label})." }, tags: { type: "array", items: { type: "string" } }, publish: { type: "boolean" }, key: { type: "string" } } },
  },
  {
    name: "get_document",
    description: "Get a process as a document: md (Markdown with diagrams and full data), html (the swim-lane flow as a self-contained page), skill (a Claude SKILL.md), or gpt (ChatGPT instructions). Use public_id for a published process, or process_id plus your key for your own.",
    inputSchema: { type: "object", properties: { public_id: { type: "string" }, process_id: { type: "string" }, key: { type: "string" }, format: { type: "string", enum: ["md", "html", "skill", "gpt"] } } },
  },
];

const text = (t: string, isError = false) => ({ content: [{ type: "text", text: t }], ...(isError ? { isError: true } : {}) });

async function callTool(req: NextRequest, name: string, a: Record<string, any>) {
  const origin = new URL(req.url).origin;
  if (name === "save_process") {
    let user = null as Awaited<ReturnType<typeof userFrom>>, newKey: string | null = null;
    if (typeof a.key === "string") user = await prisma.user.findUnique({ where: { anonKey: a.key } });
    if (!user) {
      const g = await newGuest(req);
      if (!g) return text("Too many new guests from this network. Try again later.", true);
      user = g.user; newKey = g.key;
    }
    if (await limited("agent_process", hashIp(req), user.id, 120, 300)) return text("Too many requests. Try again later.", true);
    const { key: _k, ...input } = a;
    const r = await saveForUser(user, input, origin);
    if (r.status !== 200) return text(String(r.body.error || "Could not save."), true);
    return text(JSON.stringify({ ...r.body, handle: user.handle, ...(newKey ? { key: newKey, note: "Keep this key and pass it as 'key' to update this process later." } : {}) }, null, 2));
  }
  if (name === "list_public") {
    const q = String(a.q || "").trim().slice(0, 80), tag = cleanTag(a.tag);
    const where: any = { AND: [...(tag ? [{ tags: { has: tag } }] : []), ...(q ? [{ OR: [{ title: { contains: q, mode: "insensitive" } }, { authorName: { contains: q, mode: "insensitive" } }, { tags: { has: cleanTag(q) } }] }] : [])] };
    const rows = await prisma.publicProcess.findMany({ where, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, title: true, authorName: true, tags: true, stepCount: true, likes: true } });
    return text(JSON.stringify(rows.map(r => ({ ...r, url: `${origin}/p/${r.id}` })), null, 2));
  }
  if (name === "add_comment") {
    let user = null as Awaited<ReturnType<typeof userFrom>>, newKey: string | null = null;
    if (typeof a.key === "string") user = await prisma.user.findUnique({ where: { anonKey: a.key } });
    if (!user) { const g = await newGuest(req); if (!g) return text("Too many new guests from this network. Try again later.", true); user = g.user; newKey = g.key; }
    const pub = await prisma.publicProcess.findUnique({ where: { id: String(a.public_id) }, select: { doc: true } });
    if (!pub) return text("Not found.", true);
    const body = String(a.body || "").trim().slice(0, 1000);
    if (!body) return text("Write something first.", true);
    let stepRef: string | null = null, stepLabel: string | null = null;
    const ref = String(a.step || "");
    if (ref.includes("|")) { const [mid, sid] = ref.split("|"); const st = ((pub.doc as any)?.maps?.[mid]?.steps || []).find((s: any) => s.id === sid); if (st) { stepRef = ref; stepLabel = String(st.label).slice(0, 160); } }
    const c = await prisma.comment.create({ data: { publicId: String(a.public_id), userId: user.id, authorName: user.handle, body, stepRef, stepLabel } });
    const count = await prisma.comment.count({ where: { publicId: String(a.public_id) } });
    await prisma.publicProcess.update({ where: { id: String(a.public_id) }, data: { commentCount: count } });
    return text(JSON.stringify({ ok: true, id: c.id, handle: user.handle, ...(newKey ? { key: newKey } : {}) }));
  }
  if (name === "combine_processes") {
    let user = null as Awaited<ReturnType<typeof userFrom>>, newKey: string | null = null;
    if (typeof a.key === "string") user = await prisma.user.findUnique({ where: { anonKey: a.key } });
    if (!user) { const g = await newGuest(req); if (!g) return text("Too many new guests from this network. Try again later.", true); user = g.user; newKey = g.key; }
    const { key: _k, ...input } = a;
    const r = await combineForUser(user, input, origin);
    if (r.status !== 200) return text(String(r.body.error || "Could not combine."), true);
    return text(JSON.stringify({ ...r.body, handle: user.handle, ...(newKey ? { key: newKey } : {}) }, null, 2));
  }
  if (name === "get_document") {
    const format = ["md", "html", "skill", "gpt"].includes(a.format) ? a.format : "md";
    if (a.public_id) {
      const r = await prisma.publicProcess.findUnique({ where: { id: String(a.public_id) } });
      if (!r) return text("Not found.", true);
      return text(await renderDoc(r.doc, format, { author: r.authorName, url: `${origin}/p/${r.id}` }).text());
    }
    if (a.process_id && a.key) {
      const user = await prisma.user.findUnique({ where: { anonKey: String(a.key) } });
      if (!user) return text("Unknown key.", true);
      const { process: p, role } = await accessTo(String(a.process_id), user.id);
      if (!p || !role) return text("Not found.", true);
      return text(await renderDoc(p.doc, format).text());
    }
    return text("Pass public_id, or process_id with your key.", true);
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
  let m: any;
  try { m = await req.json(); } catch { return withCors(rpcError(null, -32700, "Parse error")); }
  if (Array.isArray(m)) return withCors(rpcError(null, -32600, "Batches are not supported"));
  const { id, method, params } = m || {};
  if (id === undefined) return withCors(new Response(null, { status: 202 })); // notification
  try {
    if (method === "initialize") {
      return withCors(rpc(id, {
        protocolVersion: params?.protocolVersion || "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "process-the-world", version: "1.0.0" },
        instructions: "Build swim-lane process maps. Before drawing something from scratch, search list_public: reuse and link existing public processes (combine_processes, or a step's link) just like a person using the site. Interview the person one question at a time, then call save_process (no account needed; a guest is created on the first save). Set publish true to get a shareable link. Always give every decision a labeled arrow for each outcome, including 'no'.",
      }));
    }
    if (method === "ping") return withCors(rpc(id, {}));
    if (method === "tools/list") return withCors(rpc(id, { tools: TOOLS }));
    if (method === "tools/call") {
      if (!TOOLS.some(t => t.name === params?.name)) return withCors(rpcError(id, -32602, "Unknown tool"));
      return withCors(rpc(id, await callTool(req, params.name, params.arguments || {})));
    }
    return withCors(rpcError(id, -32601, "Method not found"));
  } catch (e: any) {
    return withCors(rpc(id, text("Something went wrong: " + String(e?.message || e).slice(0, 200), true)));
  }
}
