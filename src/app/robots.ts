import type { MetadataRoute } from "next";

const SITE = "https://forks.world";

// Everyone is welcome, search engines and AI crawlers included. The API is for agents, not for crawling.
export default function robots(): MetadataRoute.Robots {
  const open = { allow: ["/", "/api/world", "/llms.txt", "/agents.md", "/openapi.json"], disallow: ["/api/world/ops", "/api/world/agents", "/api/mcp"] };
  return {
    rules: [
      { userAgent: "*", ...open },
      ...["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "anthropic-ai", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot", "Bytespider", "cohere-ai"].map(userAgent => ({ userAgent, ...open })),
    ],
    sitemap: [`${SITE}/sitemap.xml`],
    host: SITE,
  };
}
