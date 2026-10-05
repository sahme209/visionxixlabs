/**
 * Source-text verification (see HomepageMediaShowcase.test.ts for why:
 * this repo's vitest runs in a plain Node environment with no
 * jsdom/React Testing Library, so component functions aren't rendered
 * directly in tests).
 *
 * This locks in the honesty contract for the homepage's embedded
 * interactive demo preview: it must use real scenario data and the
 * real StepVisual renderer that /demo uses — never fabricated content —
 * and must carry the same "SANDBOX · example only" labeling as /demo.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
}

describe("HomepageInteractiveDemo — honesty contract", () => {
  const src = source("components/marketing/HomepageInteractiveDemo.tsx");

  it("renders real scenario data via the same StepVisual /demo uses, not a bespoke mock", () => {
    expect(src).toContain('import { StepVisual } from "@/app/demo/[id]/StepVisual"');
    expect(src).toContain("DEMO_SCENARIOS.first_time_workspace_setup");
  });

  it("carries the same SANDBOX · example only labeling as /demo", () => {
    expect(src).toContain("SANDBOX");
    expect(src).toContain("example only");
  });

  it("links out to the full /demo scenario instead of faking the remaining steps", () => {
    expect(src).toContain("href={`/demo/${SCENARIO.id}`}");
  });

  it("is actually wired into the homepage, not dead code", () => {
    const page = source("app/page.tsx");
    expect(page).toContain('import { HomepageInteractiveDemo } from "@/components/marketing/HomepageInteractiveDemo";');
    expect(page).toContain("<HomepageInteractiveDemo />");
  });
});
