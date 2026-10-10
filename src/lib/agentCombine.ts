import { prisma } from "./db";
import { accessTo } from "./access";
import { saveForUser } from "./agentSave";

// Combine existing processes into a bigger one: a start, each part as a linked
// step (in order), and an end. Parts are published processes (publicId) or ones
// the person can open (id). The same thing a person does with the "Linked
// process" picker, in one call.
export async function combineForUser(user: { id: string; handle: string }, b: Record<string, any>, origin: string) {
  const parts: { id: string; label?: string }[] = (Array.isArray(b.parts) ? b.parts : [])
    .map((p: any) => (typeof p === "string" ? { id: p } : { id: String(p?.id || ""), label: p?.label }))
    .filter((p: any) => /^[A-Za-z0-9_-]{3,64}$/.test(p.id))
    .slice(0, 30);
  if (parts.length < 2) return { status: 400, body: { error: "Send at least two parts: parts: [publicId, publicId, ...] (or {id, label}).", code: "invalid_process" } };

  const titles = new Map<string, string>();
  const pubs = await prisma.publicProcess.findMany({ where: { id: { in: parts.map(p => p.id) } }, select: { id: true, title: true } });
  pubs.forEach(p => titles.set(p.id, p.title));
  for (const p of parts.filter(x => !titles.has(x.id))) {
    const { process: pr, role } = await accessTo(p.id, user.id);
    if (pr && role) titles.set(p.id, pr.title);
  }
  const missing = parts.find(p => !titles.has(p.id));
  if (missing) return { status: 400, body: { error: `"${missing.id}" isn't a published process or one of your saved or shared processes.`, code: "invalid_process" } };

  const lane = String(b.lane || "The whole process").slice(0, 60);
  const steps: any[] = [{ id: "start", lane: "flow", kind: "start", label: String(b.startLabel || "Start").slice(0, 80), next: ["p1"] }];
  parts.forEach((p, i) => {
    steps.push({ id: "p" + (i + 1), lane: "flow", label: String(p.label || titles.get(p.id)).slice(0, 160), link: p.id, next: [i + 1 < parts.length ? "p" + (i + 2) : "end"] });
  });
  steps.push({ id: "end", lane: "flow", kind: "end", label: String(b.endLabel || "Done").slice(0, 80) });

  const title = String(b.title || parts.map(p => titles.get(p.id)).join(", then ")).slice(0, 200);
  return saveForUser(user, { title, tags: b.tags, publish: b.publish === true, id: b.id, lanes: [{ id: "flow", name: lane, type: "person" }], steps }, origin);
}
