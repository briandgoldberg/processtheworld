import { exportMarkdown } from "./exportMd";
import { claudeSkill, chatgptInstructions } from "./agentExport";
import { flowHtml } from "./flowHtml";

/** Renders a process in the format asked for: md (default), html (the swim-lane flow), skill, or gpt. */
export function renderDoc(doc: any, format: string | null, opts: { url?: string; author?: string } = {}) {
  const headers = (type: string) => ({ "content-type": type + "; charset=utf-8", "cache-control": "no-store" });
  if (format === "html") return new Response(flowHtml(doc, opts), { headers: headers("text/html") });
  if (format === "skill") return new Response(claudeSkill(doc), { headers: headers("text/markdown") });
  if (format === "gpt") return new Response(chatgptInstructions(doc).text, { headers: headers("text/plain") });
  return new Response(exportMarkdown(doc, opts), { headers: headers("text/markdown") });
}
