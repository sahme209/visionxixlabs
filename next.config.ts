import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  async redirects() {
    return [
      { source: "/cloud-review", destination: "/free-review", permanent: true },
      { source: "/website-builder", destination: "/builder", permanent: true },
      { source: "/visionxix-ai/pricing", destination: "/products", permanent: false },
      { source: "/pricing", destination: "/products", permanent: false },
    ];
  },
  images: {
    unoptimized: false,
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: "/embed/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
    ];
  },
};

export default nextConfig;
