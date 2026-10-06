/**
 * Source-text verification — this repo's vitest config runs in a plain
 * Node environment with no jsdom/React Testing Library configured (see
 * lib/__tests__/desktopHomepagePresentation.test.ts for the same
 * established pattern), so a real render test isn't available. This
 * instead locks in the component's honesty contract by asserting the
 * real logic is present in source: fallback-on-missing-asset, no fake
 * placeholder, and the exact file paths the capture script writes to.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
}

describe("HomepageMediaShowcase — honesty contract", () => {
  const src = source("components/marketing/HomepageMediaShowcase.tsx");

  it("checks for the real files the capture script writes, via fs.existsSync", () => {
    expect(src).toContain("existsSync");
    expect(src).toContain("homepage-desktop.png");
    expect(src).toContain("homepage-walkthrough.webm");
    expect(src).toContain("homepage-walkthrough.vtt");
  });

  it("falls back to the caller-supplied content when no real asset exists", () => {
    expect(src).toContain("if (!hasVideo && !hasScreenshot) return <>{fallback}</>;");
  });

  it("never constructs an <img>/<video> src pointing at a file it hasn't verified exists", () => {
    // Both branches of the hasVideo ternary only run after the early
    // fallback return above, so by construction neither can be reached
    // with hasVideo and hasScreenshot both false.
    expect(src).toMatch(/if \(!hasVideo && !hasScreenshot\) return/);
    expect(src).toMatch(/\{hasVideo \? \(/);
  });

  it("only renders a captions track when a real .vtt file was found", () => {
    expect(src).toMatch(/hasCaptions\s*\?\s*<track/);
  });

  it("is actually wired into the homepage, not dead code", () => {
    const page = source("app/page.tsx");
    expect(page).toContain('import { HomepageMediaShowcase } from "@/components/marketing/HomepageMediaShowcase";');
    expect(page).toContain("<HomepageMediaShowcase");
    // The existing illustrative demo must be passed as the fallback, so
    // the homepage renders identically to today until real media exists.
    expect(page).toMatch(/fallback=\{[\s\S]*<DeploymentLifecycleDemo \/>[\s\S]*\}/);
  });

  it("the capture script writes to public/media by default, matching where this component looks", () => {
    const script = source("scripts/capture-homepage-media.mjs");
    expect(script).toContain('path.join(process.cwd(), "public", "media")');
  });
});
