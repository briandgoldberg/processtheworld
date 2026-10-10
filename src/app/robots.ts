import type { MetadataRoute } from "next";

const SITE = "https://forks.world";

// Everyone is welcome, search engines and AI crawlers included, except the private and admin parts.
export default function robots(): MetadataRoute.Robots {
  const open = { allow: "/", disallow: ["/admin", "/api/admin", "/api/processes", "/invite", "/restore"] };
  return {
    rules: [
      { userAgent: "*", ...open },
      ...["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "anthropic-ai", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot", "Bytespider", "cohere-ai"].map(userAgent => ({ userAgent, allow: ["/", "/api/public", "/llms.txt", "/agents.md", "/openapi.json"], disallow: open.disallow })),
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
