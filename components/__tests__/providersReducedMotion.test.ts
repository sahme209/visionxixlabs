/**
 * Locks in sitewide prefers-reduced-motion support. 16+ files call
 * framer-motion directly (motion.*, AnimatePresence) without going
 * through the reduced-motion-aware components/motion/Reveal.tsx or
 * Stagger.tsx wrappers. <MotionConfig reducedMotion="user"> at the root
 * Providers wrapper is framer-motion's own documented fix: it makes
 * every motion component site-wide honor the OS-level
 * prefers-reduced-motion setting automatically, with no visual change
 * for users who haven't opted in.
 *
 * This is a source-text assertion, not a render test — vitest runs in
 * a plain Node environment here (no jsdom configured), matching this
 * repo's established convention for client-component regression
 * coverage (see lib/__tests__/desktopHomepagePresentation.test.ts for
 * the same pattern).
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("Providers — sitewide reduced-motion support", () => {
  it("imports MotionConfig from framer-motion and sets reducedMotion to 'user'", () => {
    const providers = source("components/Providers.tsx");
    expect(providers).toContain('import { MotionConfig } from "framer-motion"');
    expect(providers).toContain('reducedMotion="user"');
  });

  it("wraps children in MotionConfig inside the real provider tree (not dead code)", () => {
    const providers = source("components/Providers.tsx");
    expect(providers).toMatch(/<MotionConfig reducedMotion="user">\s*\{children\}\s*<\/MotionConfig>/);
  });

  it("app/layout.tsx actually renders Providers, so this wrapper is live on every page", () => {
    const layout = source("app/layout.tsx");
    expect(layout).toContain("Providers");
  });
});
