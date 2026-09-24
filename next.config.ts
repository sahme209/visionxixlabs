import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  productionBrowserSourceMaps: false,
  experimental: {
    cpus: 1,
    webpackBuildWorker: true,
    webpackMemoryOptimizations: true,
    serverSourceMaps: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      // Canonical routing
      { source: "/operator", destination: "/operator/onboarding", permanent: true },
      // /operator/pricing replaced by the glowy /plans surface; keep the URL alive.
      { source: "/operator/pricing", destination: "/plans", permanent: true },
      { source: "/pricing", destination: "/plans", permanent: false },
      { source: "/axiom/pricing", destination: "/plans", permanent: true },
      { source: "/request", destination: "/contact", permanent: true },
      // VisionXIXLabs internal marketing cockpit moved out of /dashboard
      // (client layer) and into /admin (internal layer).
      { source: "/dashboard/marketing", destination: "/admin/marketing", permanent: true },
      // Operator-only debug surfaces moved from /dashboard (client layer)
      // to /admin (internal layer) in the product-layer separation pass.
      { source: "/dashboard/flags",            destination: "/admin/flags",            permanent: true },
      { source: "/dashboard/self-diagnostic",  destination: "/admin/self-diagnostic",  permanent: true },
      { source: "/dashboard/cron-health",      destination: "/admin/cron-health",      permanent: true },
      { source: "/dashboard/admin-charters",   destination: "/admin/charters",         permanent: true },

      // Removed pages → homepage
      { source: "/builder", destination: "/", permanent: true },
      { source: "/builder/:path*", destination: "/", permanent: true },
      { source: "/website-builder", destination: "/", permanent: true },
      { source: "/visionxix-ai", destination: "/", permanent: true },
      { source: "/visionxix-ai/:path*", destination: "/", permanent: true },
      { source: "/visionxix-ai-assistant", destination: "/", permanent: true },
      { source: "/ai-solutions", destination: "/", permanent: true },
      { source: "/ai-solutions/:path*", destination: "/", permanent: true },
      { source: "/ai-engineering", destination: "/", permanent: true },
      { source: "/apps", destination: "/", permanent: true },
      { source: "/markets", destination: "/", permanent: true },
      { source: "/solutions-for-growing-teams", destination: "/", permanent: true },
      { source: "/cloud-studio", destination: "/", permanent: true },
      { source: "/cloud-studio/:path*", destination: "/", permanent: true },
      // /demo is the canonical sandbox + per-scenario walkthrough.
      // /platform-demo was a duplicate marketing surface; consolidated
      // into /demo so there's a single URL to share.
      { source: "/platform-demo", destination: "/demo", permanent: true },
      { source: "/products", destination: "/operator/pricing", permanent: true },
      { source: "/free-review", destination: "/", permanent: true },
      { source: "/cloud-review", destination: "/", permanent: true },
      { source: "/internal/:path*", destination: "/", permanent: true },
      { source: "/embed/:path*", destination: "/", permanent: true },
      { source: "/chatbot", destination: "/", permanent: true },
      { source: "/chatbot/:path*", destination: "/", permanent: true },
      { source: "/dashboard/bots/:path*", destination: "/", permanent: true },
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
