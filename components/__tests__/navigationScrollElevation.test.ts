/**
 * Locks in the nav's scroll-elevation behavior (shrink + deepen border/
 * shadow past 8px of scroll). Source-text assertion, not a render test —
 * see providersReducedMotion.test.ts for why (plain Node vitest env,
 * no jsdom configured).
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("../Navigation.tsx", import.meta.url), "utf8");

describe("Navigation — scroll elevation", () => {
  it("tracks scroll position with a passive listener, cleaned up on unmount", () => {
    expect(src).toContain('window.scrollY > 8');
    expect(src).toContain('window.addEventListener("scroll", onScroll, { passive: true })');
    expect(src).toContain('window.removeEventListener("scroll", onScroll)');
  });

  it("deepens the border/shadow and shrinks the bar height once scrolled", () => {
    expect(src).toMatch(/scrolled\s*\n?\s*\?\s*"border-b border-white\/\[0\.09\]/);
    expect(src).toContain('h-14 lg:h-16');
  });

  it("still renders the non-scrolled state as the initial default", () => {
    expect(src).toContain("useState(false)");
    expect(src).toContain('h-16 lg:h-[72px]');
  });
});
