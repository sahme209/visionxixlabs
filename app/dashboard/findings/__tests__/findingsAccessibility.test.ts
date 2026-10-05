/**
 * Continues the accessibility sweep into /dashboard/findings. Source-
 * text assertion, not a render test — see providersReducedMotion.test.ts
 * for why.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("../page.tsx", import.meta.url), "utf8");

describe("/dashboard/findings — accessibility", () => {
  it("labels the search input (previously had a placeholder only, no accessible name)", () => {
    expect(src).toContain('aria-label="Search findings by title or description"');
  });
});
