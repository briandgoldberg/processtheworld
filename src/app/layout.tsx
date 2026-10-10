import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const SITE = "https://forks.world";
const DESCRIPTION = "forks.world is a library of process maps for how the world works. Browse swim-lane maps of science, business, politics and daily life, make your own, or connect Claude or ChatGPT to create and publish them.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "forks.world: Mapping how the world works", template: "%s | forks.world" },
  description: DESCRIPTION,
  keywords: ["process map", "process mapping", "swim lane diagram", "workflow", "flowchart", "how things work", "MCP server", "Claude", "ChatGPT", "AI agents", "process documentation", "SOP"],
  applicationName: "forks.world",
  alternates: { canonical: "/", types: { "text/markdown": "/agents.md" } },
  openGraph: { type: "website", siteName: "forks.world", title: "forks.world: Mapping how the world works", description: DESCRIPTION, url: SITE },
  twitter: { card: "summary_large_image", title: "forks.world: Mapping how the world works", description: DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

// What this site is, in a form search engines and AI tools can read.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite", "@id": `${SITE}/#website`, url: SITE, name: "forks.world", description: DESCRIPTION,
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE}/api/public?q={search_term_string}` }, "query-input": "required name=search_term_string" },
    },
    {
      "@type": "WebApplication", "@id": `${SITE}/#app`, name: "forks.world", url: SITE, applicationCategory: "BusinessApplication", operatingSystem: "Any",
      description: "Create, publish and share swim-lane process maps. Works with Claude and ChatGPT through an MCP connector, a skill and an HTTP API.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: ["Swim-lane process maps", "Guided walkthroughs", "Combine published processes", "MCP server for Claude and ChatGPT", "OpenAPI and llms.txt for AI agents"],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Public+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt" />
        <link rel="alternate" type="application/json" href="/openapi.json" title="OpenAPI" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      </head>
      <body>{children}<Analytics /></body>
    </html>
  );
}
