import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "forks.world",
    short_name: "forks.world",
    description: "Mapping how the world works. A library of process maps, made with AI.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2448C9",
    icons: [{ src: "/icon", sizes: "64x64", type: "image/png" }],
  };
}
