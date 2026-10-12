import { MetadataRoute } from "next";

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
        src: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/vision-xix-logo.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/vision-xix-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    categories: ["business", "productivity"],
  };
}
