/**
 * Continues the accessibility sweep into /dashboard/settings. Source-
 * text assertion, not a render test — see providersReducedMotion.test.ts
 * for why (plain Node vitest env here).
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(`../../../../${path}`, import.meta.url), "utf8");
}

describe("/dashboard/settings/workspace — accessibility", () => {
  const src = source("app/dashboard/settings/workspace/page.tsx");

  it("announces the workspace-unavailable error (previously had no role/aria-live)", () => {
    expect(src).toContain('role="alert" aria-live="assertive"');
  });
});

describe("/dashboard/settings/notifications — accessibility and correctness", () => {
  const src = source("app/dashboard/settings/notifications/page.tsx");

  it("announces both the save error and the save confirmation", () => {
    expect(src).toContain('role="status" aria-live="polite"');
    expect(src).toContain('role="alert" aria-live="assertive"');
  });

  it("surfaces an initial-load failure instead of spinning forever", () => {
    // Previously: `phase === "loading" || !prefs` stayed true forever when
    // the initial fetch failed (phase becomes "error" but prefs never gets
    // set), so the page showed an infinite spinner and never rendered the
    // error at all.
    expect(src).toContain('if (phase === "error" && !prefs)');
  });
});
