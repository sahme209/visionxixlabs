/**
 * Inventory contract: every app/api/** route that imports a raw LLM
 * provider SDK directly (@anthropic-ai/sdk, openai) must either route
 * through the common enforcement boundary (workspace policy + provider
 * allowlist + budget check — see lib/releaseops/instrumentedAiFetcher.ts
 * and app/api/ai/generate/route.ts) or be in the explicit allowlist below
 * with a documented reason.
 *
 * Without this test, a newly added route that imports the SDK directly
 * passes CI silently and bypasses workspace AI policy entirely — this is
 * exactly the shape of bug a prior audit this session found twice
 * already (both confirmed-dormant at the time, but found by manual grep,
 * not by anything CI would have caught on a new one).
 *
 * Allowlist entries are route files, not directories — every entry must
 * be re-justified individually, so adding a new tenant-facing route next
 * to an allowlisted internal one doesn't silently inherit the exemption.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const API_ROOT = join(process.cwd(), "app/api");

/**
 * Routes that legitimately call a raw provider SDK without workspace
 * context. Each entry must name a real, currently-existing reason — not
 * "will fix later."
 */
const ALLOWLIST: Record<string, string> = {
  "app/api/admin/anthropic-test/route.ts":
    "Platform-operator diagnostic (gated by requireAdmin — a global ADMIN_EMAILS allowlist, not a tenant). Proves the Anthropic API key itself works; there is no workspace to attach policy/budget to. No UI references this route.",
  "app/api/admin/agi-smoke-test/route.ts":
    "Platform-operator diagnostic (gated by requireAdmin). Internal smoke test with no organizationId in scope. No UI references this route.",
};

const RAW_SDK_PATTERNS = [/@anthropic-ai\/sdk/, /from\s+["']openai["']/, /require\(["']openai["']\)/];

const GOVERNANCE_MARKERS = [
  "makeInstrumentedFetcher",
  "makeLiveRationaleFetcher",
  "loadWorkspaceAIProviderPolicyWithState",
  "checkWorkspaceAICredits",
];

function walkRouteFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkRouteFiles(full, out);
    } else if (entry === "route.ts") {
      out.push(full);
    }
  }
  return out;
}

describe("AI route governance inventory", () => {
  const routeFiles = walkRouteFiles(API_ROOT);

  it("found at least the known allowlisted routes (sanity check that the scan itself works)", () => {
    const relPaths = routeFiles.map((f) => relative(process.cwd(), f).replaceAll("\\", "/"));
    expect(relPaths).toEqual(expect.arrayContaining(Object.keys(ALLOWLIST)));
  });

  it("every route importing a raw provider SDK is either governed or explicitly allowlisted with a reason", () => {
    const violations: string[] = [];

    for (const file of routeFiles) {
      const relPath = relative(process.cwd(), file).replaceAll("\\", "/");
      const source = readFileSync(file, "utf8");
      const importsRawSdk = RAW_SDK_PATTERNS.some((p) => p.test(source));
      if (!importsRawSdk) continue;

      if (relPath in ALLOWLIST) continue;

      const isGoverned = GOVERNANCE_MARKERS.some((marker) => source.includes(marker));
      if (!isGoverned) {
        violations.push(relPath);
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Route(s) import a raw LLM provider SDK directly without routing through the workspace AI policy boundary, and are not in the allowlist:\n` +
          violations.map((v) => `  - ${v}`).join("\n") +
          `\n\nEither route the call through lib/releaseops/instrumentedAiFetcher.ts (or an equivalent that checks workspace policy/budget), or add the file to ALLOWLIST in this test with a documented reason — only for genuinely non-tenant-facing, platform-operator-only routes.`,
      );
    }
    expect(violations).toEqual([]);
  });
});
