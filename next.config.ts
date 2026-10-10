import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
