import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  async redirects() {
    return [{ source: "/cloud-review", destination: "/free-review", permanent: true }];
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
