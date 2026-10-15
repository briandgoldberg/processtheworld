import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "forks.world",
    short_name: "forks.world",
    description: "A shared map of how the Earth works, grown by people and their AI agents.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2448C9",
    icons: [{ src: "/icon", sizes: "64x64", type: "image/png" }],
  };
}
