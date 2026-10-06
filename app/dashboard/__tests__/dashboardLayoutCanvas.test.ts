/**
 * Locks in the dashboard shell's canvas treatment. The dashboard used
 * to render on a flat bg-[#09090b] + bg-grid-mesh overlay — the same
 * "technical grid" texture a prior pass explicitly moved other product
 * pages (/security, /resources, /integrations) away from in favor of
 * the quieter axiom-product-canvas gradient (see the comment above
 * .axiom-product-canvas in app/globals.css). The dashboard never got
 * that same upgrade; this closes that gap so every signed-in page
 * shares the same visual home as the public product pages.
 *
 * Source-text assertion, not a render test — see
 * providersReducedMotion.test.ts for why.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("../layout.tsx", import.meta.url), "utf8");

describe("Dashboard layout — canvas treatment", () => {
  it("uses the shared product canvas instead of the old flat grid-mesh texture", () => {
    expect(src).toContain("axiom-canvas axiom-product-canvas");
    expect(src).not.toContain("bg-grid-mesh");
    expect(src).not.toContain("bg-[#09090b]");
  });
});
