import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
