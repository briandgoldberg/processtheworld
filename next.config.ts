import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second address for the same sitemap, so Search Console can fetch it fresh
  // The old /test pages now live on the main site
  async redirects() {
    return [
      { source: "/test", destination: "/", permanent: true },
      { source: "/test/map/:id", destination: "/map/:id", permanent: true },
      { source: "/test/:path*", destination: "/map/p0", permanent: true },
      { source: "/library", destination: "/map/p0", permanent: true },
      { source: "/mine", destination: "/", permanent: true },
      { source: "/team", destination: "/", permanent: true },
      { source: "/admin", destination: "/", permanent: true },
      { source: "/p/:id", destination: "/map/p0", permanent: true },
      { source: "/topics/:tag", destination: "/map/p0", permanent: true },
    ];
  },
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
