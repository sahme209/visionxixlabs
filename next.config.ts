import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  async redirects() {
    return [
      { source: "/visionxix-ai/pricing", destination: "/products", permanent: true },
      { source: "/pricing", destination: "/products", permanent: false },
      { source: "/operator", destination: "/cloud-operator", permanent: true },
      { source: "/request", destination: "/contact", permanent: true },
      { source: "/builder", destination: "/", permanent: true },
      { source: "/builder/:path*", destination: "/", permanent: true },
      { source: "/website-builder", destination: "/", permanent: true },
      { source: "/cloud-solutions", destination: "/", permanent: true },
      { source: "/cloud-solutions/:path*", destination: "/", permanent: true },
      { source: "/ai-solutions", destination: "/", permanent: true },
      { source: "/ai-solutions/:path*", destination: "/", permanent: true },
      { source: "/ai-engineering", destination: "/", permanent: true },
      { source: "/visionxix-ai", destination: "/", permanent: true },
      { source: "/visionxix-ai/:path*", destination: "/", permanent: true },
      { source: "/axiom", destination: "/", permanent: true },
      { source: "/apps", destination: "/", permanent: true },
      { source: "/services", destination: "/", permanent: true },
      { source: "/cloud-security", destination: "/", permanent: true },
      { source: "/solutions-for-growing-teams", destination: "/", permanent: true },
      { source: "/markets", destination: "/", permanent: true },
      { source: "/enterprise-readiness", destination: "/", permanent: true },
      { source: "/case-studies", destination: "/", permanent: true },
      { source: "/free-review", destination: "/", permanent: true },
      { source: "/cloud-review", destination: "/", permanent: true },
      { source: "/press", destination: "/", permanent: true },
      { source: "/chatbot", destination: "/", permanent: true },
      { source: "/chatbot/:path*", destination: "/", permanent: true },
    ];
  },
  images: {
    unoptimized: false,
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
      {
        source: "/embed/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
    ];
  },
};

export default nextConfig;
