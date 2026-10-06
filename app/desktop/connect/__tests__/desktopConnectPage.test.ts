/**
 * Locks in: a signed-in, no-workspace-entitlement user reaches a visible
 * "request access" state on /desktop/connect rather than being blocked or
 * redirected away. Entitlement is surfaced as a banner, not a gate —
 * pairing stays reachable for identity-verified users regardless of
 * commercial entitlement (operational desktop routes are the actual
 * entitlement boundary; see resolveRequestDesktopSessionEntitlement.test.ts).
 *
 * Testing this as a source contract, consistent with this repo's existing
 * page-behavior lock-ins (see desktopHomepagePresentation.test.ts) — there
 * is no React server-component render harness in this project to assert
 * against instead.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(`../../../../${path}`, import.meta.url), "utf8");
}

describe("/desktop/connect — signed-in, no-entitlement state", () => {
  const page = source("app/desktop/connect/page.tsx");

  it("only redirects away for an unauthenticated visitor, not for a non-entitled one", () => {
    expect(page).toMatch(/if \(!context\.isAuthenticated\)\s*{\s*[\s\S]*?redirect\(/);
    // The entitlement read happens strictly after the auth redirect branch,
    // and nothing between it and PairDesktopClient returns/redirects.
    const afterAuthCheck = page.slice(page.indexOf("const access = await readDesktopCommercialAccess"));
    expect(afterAuthCheck).not.toMatch(/redirect\(/);
    expect(afterAuthCheck).not.toMatch(/return <Message/);
  });

  it("renders a visible request-access banner when entitlement is missing", () => {
    expect(page).toContain("!access.allowed");
    expect(page).toContain("access.title");
    expect(page).toContain("access.message");
    expect(page).toContain("Request production access");
  });

  it("still renders the pairing control even when entitlement is missing (pairing is not entitlement-gated)", () => {
    const bannerIndex = page.indexOf("!access.allowed");
    const pairClientIndex = page.indexOf("<PairDesktopClient");
    expect(bannerIndex).toBeGreaterThan(-1);
    expect(pairClientIndex).toBeGreaterThan(bannerIndex);
  });
});
