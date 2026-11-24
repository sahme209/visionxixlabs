import type { MetadataRoute } from "next";
import { AXIOM_APP_ICON_192_URL, AXIOM_APP_ICON_URL, AXIOM_FAVICON_URL } from "@/lib/brandAssets";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vision XIX Labs",
    short_name: "Vision XIX Labs",
    description: "Governed AI-assisted GitHub changes and AWS ECS deployments from request to auditable outcome.",
    start_url: "/",
    display: "standalone",
    background_color: "#141414",
    theme_color: "#f54e00",
    icons: [
      {
        src: AXIOM_FAVICON_URL,
        sizes: "32x32",
        type: "image/png",
        purpose: "any",
      },
      {
        src: AXIOM_APP_ICON_192_URL,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: AXIOM_APP_ICON_URL,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    categories: ["business", "productivity"],
  };
}
