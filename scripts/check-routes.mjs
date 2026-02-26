#!/usr/bin/env node
/**
 * End-to-End Route Check (dev-only)
 * Validates key routes exist and return 200 or at least render.
 * Run: node scripts/check-routes.mjs
 * Prerequisites: Start dev server first: npm run dev
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";

const ROUTES = [
  "/",
  "/cloud-operator",
  "/request",
  "/request/thank-you",
  "/cloud-studio",
  "/cloud-studio/result",
  "/contact",
  "/insights",
  "/ai-solutions",
  "/cloud-solutions",
  "/free-review",
  "/apps",
  "/visionxix-ai",
  "/visionxix-ai/pricing",
];

async function check(url) {
  try {
    const res = await fetch(url, { redirect: "follow" });
    return { url, ok: res.ok, status: res.status };
  } catch (e) {
    return { url, ok: false, status: 0, error: e.message };
  }
}

async function main() {
  console.log("Checking routes at", BASE);
  let passed = 0;
  let failed = 0;

  for (const path of ROUTES) {
    const full = `${BASE}${path}`;
    const r = await check(full);
    if (r.ok) {
      console.log(`✓ ${path} ${r.status}`);
      passed++;
    } else {
      console.log(`✗ ${path} ${r.status}${r.error ? ` (${r.error})` : ""}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
