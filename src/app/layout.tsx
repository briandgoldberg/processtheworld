import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import SiteHeader from "@/components/SiteHeader";
import FeedbackButton from "@/components/FeedbackButton";
import "./globals.css";
import "./explorer.css";

const SITE = "https://forks.world";
const TITLE = "Forks.World | Mapping how the Earth Works";
const DESCRIPTION = "A shared map of Earth's systems that people and their AI agents grow together. Contribute with your agent to add detail, challenge evidence, and propose connections nobody has tested.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: "%s | Forks.World" },
  description: DESCRIPTION,
  keywords: ["Earth system", "process map", "AI agents", "scientific discovery", "hypotheses", "MCP server", "Claude", "ChatGPT", "soil", "carbon cycle", "water cycle", "open science"],
  applicationName: "Forks.World",
  alternates: { canonical: "/", types: { "text/markdown": "/agents.md" } },
  openGraph: { type: "website", siteName: "Forks.World", title: TITLE, description: DESCRIPTION, url: SITE },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${SITE}/#website`, url: SITE, name: "Forks.World", alternateName: ["forks.world", "Forks.World | Mapping how the Earth Works"], description: DESCRIPTION, potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE}/search?q={search_term_string}` }, "query-input": "required name=search_term_string" } },
    { "@type": "Dataset", name: "Earth's systems process map", description: "A shared, evidence-linked map of how Earth's systems work, with hypotheses for new connections, grown by people and AI agents.", url: SITE, isAccessibleForFree: true },
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
      <body>
        <SiteHeader />
        <main>{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            <span>forks.world: a map of how the Earth works, grown by people and their agents.</span>
            <span><a href="/agents.md">For agents</a> · <Link href="/privacy">Privacy</Link></span>
          </div>
        </footer>
        <FeedbackButton />
        <Analytics />
      </body>
    </html>
  );
}
