import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second address for the same sitemap, so Search Console can fetch it fresh
  async rewrites() {
    return [{ source: "/sitemap-main.xml", destination: "/sitemap.xml" }];
  },
  // Tell any client (and any AI agent) where the machine-readable description lives.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Link", value: '</llms.txt>; rel="describedby"; type="text/plain", </openapi.json>; rel="service-desc"; type="application/json", </agents.md>; rel="help"; type="text/markdown"' },
        ],
      },
    ];
  },
};

export default nextConfig;
