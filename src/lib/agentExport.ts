// Turns a process map into instructions an AI can follow: a Claude skill
// (SKILL.md) or ChatGPT custom-GPT instructions. Only what is on the map is
// used; nothing is added.

import { ordered, type MapT } from "./exportMd";

type Doc = { title?: string; maps: Record<string, MapT> };

const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const PAINW: Record<number, string> = { 1: "annoying", 2: "painful", 3: "critical" };
const GPT_LIMIT = 8000; // Custom GPT instructions cap

function titleOf(doc: Doc) {
  const root = doc.maps.m_root || Object.values(doc.maps)[0];
  return clean(doc.title || root?.title) || "this process";
}

export const skillSlug = (doc: Doc) => (titleOf(doc).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "") || "process");

/** The steps of one layer as a numbered list an AI can follow. */
function steps(m: MapT, doc: Doc): string {
  const lane = new Map(m.lanes.map(l => [l.id, l]));
  const label = (id: string) => clean(m.steps.find(s => s.id === id)?.label) || id;
  return ordered(m).map((s, i) => {
    const l = lane.get(s.lane);
    const who = l ? `${clean(l.name)}${l.type === "system" ? " (system)" : ""}` : "";
    const uses = (s.uses || []).map(u => clean(lane.get(u)?.name)).filter(Boolean);
    const next = (s.next || []).map(n => {
      const target = n.map ? clean(doc.maps[n.map]?.steps.find(x => x.id === n.to)?.label) || n.to : label(n.to);
      return n.label ? `if "${clean(n.label)}" -> ${target}` : `-> ${target}`;
    });
    const detail = (s.child && doc.maps[s.child] ? ` Details in "${clean(doc.maps[s.child].title) || s.child}" below.` : "") + (s.link ? (s.link.scope === "private" ? ` This step is another process: "${clean(s.link.title) || s.link.id}" (saved, not public; ask the person for its steps).` : ` This step is another process: "${clean(s.link.title) || s.link.id}". Fetch its steps from https://processtheworld.vercel.app/api/public/${s.link.id}/export and follow them here.`) : "");
    const pain = s.pain ? ` Pain point (${PAINW[s.pain.level] || "painful"})${s.pain.note ? ": " + clean(s.pain.note) : ""}. Be extra careful here and mention it.` : "";
    const tail = s.kind === "end" ? " (end)" : s.kind === "decision" ? " (decision)" : s.kind === "start" ? " (start)" : "";
    return `${i + 1}. ${clean(s.label)}${tail}. Who: ${who}${uses.length ? `. Uses: ${uses.join(", ")}` : ""}.${next.length ? ` Next: ${next.join("; ")}.` : ""}${pain}${detail}`;
  }).join("\n");
}

function layers(doc: Doc, withDetail: boolean): string {
  const root = doc.maps.m_root || Object.values(doc.maps)[0];
  const parts = [`## Steps\n\n${steps(root, doc)}`];
  if (withDetail) for (const m of Object.values(doc.maps)) if (m !== root) parts.push(`## Details: ${clean(m.title) || m.id}\n\n${steps(m, doc)}`);
  return parts.join("\n\n");
}

const RULES = [
  "Follow the steps in order. Don't skip or invent steps.",
  "At a decision, find out the answer from the user (or from information you already have) before choosing a branch.",
  "Steps done by a person are not yours: tell the user what needs doing, and wait or ask them to confirm.",
  "Steps done by a system: do them if you have access to that system; otherwise say what needs to happen there and ask the user to do it or confirm it.",
  "If something in the process doesn't match the situation, say so and ask rather than guessing.",
];

/** A Claude skill: the full SKILL.md. */
export function claudeSkill(doc: Doc): string {
  const title = titleOf(doc);
  const desc = `Walk the user through or carry out the process "${title}" step by step, using the process map below. Use when the user asks about, wants to run, or needs help with this process.`.slice(0, 1000);
  return [
    "---",
    `name: ${skillSlug(doc)}`,
    `description: ${desc.replace(/\n/g, " ")}`,
    "---",
    "",
    `# ${title}`,
    "",
    "This skill comes from a process map made on Process the World. Use it as the source of truth for how this process runs.",
    "",
    "## How to use it",
    "",
    ...RULES.map(r => `- ${r}`),
    "",
    layers(doc, true),
    "",
  ].join("\n");
}

/** ChatGPT custom-GPT instructions, kept under the 8,000 character limit. */
export function chatgptInstructions(doc: Doc): { text: string; trimmed: boolean } {
  const title = titleOf(doc);
  const build = (withDetail: boolean) => [
    `You help people with this process: "${title}". Use the process map below as the source of truth for how it runs.`,
    "",
    "Rules:",
    ...RULES.map(r => `- ${r}`),
    "",
    layers(doc, withDetail),
  ].join("\n");
  const full = build(true);
  if (full.length <= GPT_LIMIT) return { text: full, trimmed: false };
  let main = build(false) + "\n\nDetail layers are in the attached knowledge file.";
  if (main.length > GPT_LIMIT) main = main.slice(0, GPT_LIMIT - 60).replace(/\n[^\n]*$/, "") + "\n\n(Cut to fit. See the attached knowledge file.)";
  return { text: main, trimmed: true };
}
