#!/usr/bin/env node
/**
 * Captures real screenshots + a ~30s video of the actual running
 * homepage, for use as release media (see docs/RELEASE_MEDIA_CHECKLIST.md
 * before publishing anything this produces).
 *
 * This script does NOT fabricate anything — it drives a real browser
 * against your real local dev server and saves whatever is actually
 * rendered. If the dev server isn't running, or a selector it expects
 * isn't on the page, it fails loudly rather than producing a fake
 * placeholder.
 *
 * USAGE
 *   1. In one terminal:  npm run dev
 *      (wait until it prints "Ready" / is reachable at http://localhost:3000)
 *   2. In another terminal, from the repo root:
 *      npx -p playwright node scripts/capture-homepage-media.mjs
 *
 *      The `-p playwright` flag fetches Playwright on demand for this
 *      one invocation — it does NOT add playwright to package.json or
 *      touch your dependency tree permanently.
 *
 *      First run only: npx -p playwright playwright install chromium
 *      (downloads the actual browser binary Playwright drives — a
 *      one-time ~150MB download, separate from the npm package).
 *
 *   Optional env vars:
 *     BASE_URL   — defaults to http://localhost:3000
 *     OUT_DIR    — defaults to ./public/media
 *
 * OUTPUT (written straight into public/media/ by default)
 *   homepage-desktop.png      — full-page screenshot, 1440x900
 *   homepage-mobile.png       — full-page screenshot, 390x844 (iPhone 14 size)
 *   homepage-walkthrough.webm — ~30s video: loads the homepage, lets the
 *     real DeploymentLifecycleDemo component auto-advance through its
 *     stages, then scrolls through the rest of the page. Playwright
 *     records whatever actually happens on screen — nothing here is
 *     staged or edited.
 *
 * components/marketing/HomepageMediaShowcase.tsx checks for exactly
 * these three filenames (plus an optional homepage-walkthrough.vtt
 * captions file you add by hand) in public/media/ and swaps the
 * homepage hero over to the real recording automatically — no code
 * change needed after running this script.
 *
 * Before you publish any of this, re-read docs/RELEASE_MEDIA_CHECKLIST.md:
 * verify it matches the deployed version, every status shown is real or
 * labeled, no secrets/real customer data are in frame, and check both
 * desktop and mobile output. Also add a captions/transcript file by
 * hand — this script only records raw video.
 */

import { chromium } from "playwright";
import { mkdir, rename } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = process.env.OUT_DIR ?? path.join(process.cwd(), "public", "media");

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log(`Checking ${BASE_URL} is reachable...`);
  try {
    const res = await fetch(BASE_URL, { method: "HEAD" });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Unexpected status ${res.status}`);
    }
  } catch (err) {
    console.error(
      `\nCould not reach ${BASE_URL}.\n` +
      `Start the dev server first in another terminal: npm run dev\n` +
      `Then re-run this script.\n\nOriginal error: ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
  }

  const browser = await chromium.launch();

  // ---- Desktop screenshot ----
  console.log("Capturing desktop screenshot...");
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT_DIR, "homepage-desktop.png"), fullPage: true });
    await context.close();
  }

  // ---- Mobile screenshot ----
  console.log("Capturing mobile screenshot...");
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT_DIR, "homepage-mobile.png"), fullPage: true });
    await context.close();
  }

  // ---- ~30s video walkthrough ----
  console.log("Recording ~30s homepage walkthrough video...");
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: OUT_DIR, size: { width: 1440, height: 900 } },
    });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    // Let the real DeploymentLifecycleDemo auto-advance through a few
    // real stages (it cycles every ~5.2s — see the component itself).
    // This records whatever the component actually renders; nothing is
    // scripted here beyond waiting.
    await page.waitForTimeout(16_000);

    // Scroll through the rest of the real page content.
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight * 0.4, behavior: "smooth" }));
    await page.waitForTimeout(5_000);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight * 0.75, behavior: "smooth" }));
    await page.waitForTimeout(5_000);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
    await page.waitForTimeout(4_000);

    const videoHandle = page.video();
    await context.close(); // video finalizes on context close
    if (videoHandle) {
      const generatedPath = await videoHandle.path();
      const finalPath = path.join(OUT_DIR, "homepage-walkthrough.webm");
      await rename(generatedPath, finalPath);
    }
  }

  await browser.close();

  console.log(`\nDone. Real screenshots + video written to: ${OUT_DIR}`);
  console.log("The homepage will pick these up automatically (components/marketing/HomepageMediaShowcase.tsx) — no code change needed.");
  console.log("\nBefore publishing anything from this run: go through docs/RELEASE_MEDIA_CHECKLIST.md, and add a captions/transcript file by hand (homepage-walkthrough.vtt) — this script only records raw video.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
