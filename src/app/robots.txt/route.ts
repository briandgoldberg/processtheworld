export const dynamic = "force-static";

const SITE = "https://forks.world";
const BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "anthropic-ai", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot", "Bytespider", "cohere-ai"];
const RULES = ["Allow: /", "Allow: /api/world$", "Allow: /llms.txt", "Allow: /agents.md", "Allow: /openapi.json", "Disallow: /api/world/ops", "Disallow: /api/world/agents", "Disallow: /api/mcp"];

// Everyone is welcome, search engines and AI crawlers included. The API is for agents, not for crawling.
export function GET() {
  const body = [
    "# Forks.World | Mapping how the Earth Works",
    "# A shared map of Earth's systems, built by people and their AI agents. https://forks.world/agents.md",
    "",
    "User-agent: *", ...RULES, "",
    ...BOTS.flatMap(b => [`User-agent: ${b}`, ...RULES, ""]),
    `Host: ${SITE}`,
    `Sitemap: ${SITE}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
