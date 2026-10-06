/**
 * Second sitewide sweep variant: these pages use `networkError`/
 * `errorBody` instead of `error`/`setError`, so they were missed by
 * sitewideErrorAnnouncement.test.ts's grep-by-naming-convention. Same
 * defect class (no role/aria-live on real error states), found via
 * `grep -rl "networkError\|errorBody" app/dashboard`. 19 pages fixed
 * here; a further ~21 candidates with a genuinely different markup
 * shape remain unverified (see docs/AXIOM_EXECUTION_BACKLOG.md).
 *
 * Source-text assertion, not a render test — see
 * providersReducedMotion.test.ts for why.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const STANDARD_SCAFFOLD_FILES = [
  "app/dashboard/alert-escalations/page.tsx",
  "app/dashboard/deployment-incidents/page.tsx",
  "app/dashboard/releases/page.tsx",
  "app/dashboard/release-advisor/page.tsx",
  "app/dashboard/change-tickets/page.tsx",
  "app/dashboard/policy-violations/page.tsx",
  "app/dashboard/release-freeze/page.tsx",
  "app/dashboard/manual-fixes/page.tsx",
  "app/dashboard/repositories/page.tsx",
  "app/dashboard/release-notes/page.tsx",
  "app/dashboard/release-audit/page.tsx",
  "app/dashboard/cherry-picks/page.tsx",
  "app/dashboard/sops/[deploymentType]/page.tsx",
  "app/dashboard/release-readiness/page.tsx",
  "app/dashboard/applications/page.tsx",
  "app/dashboard/github-app/page.tsx",
  "app/dashboard/branch-protection/page.tsx",
];

function source(path: string): string {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
}

describe("networkError/errorBody announcement — standard scaffold", () => {
  it.each(STANDARD_SCAFFOLD_FILES)("%s announces all 3 error states", (path) => {
    const src = source(path);
    expect(src).toContain(
      'role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">\n          {networkError}',
    );
    expect(src).toContain(
      'role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6">',
    );
    expect(src).toMatch(
      /errorBody\?\.error === "auth_required" && \(\s*\n\s*<div role="alert" aria-live="assertive" className="rounded-2xl border border-white\/\[0\.18\] bg-white\/\[0\.04\] p-5 mb-6 text-\[13px\] text-zinc-300"/,
    );
  });
});

describe("networkError/errorBody announcement — non-standard variants", () => {
  it("sops page announces both its error states (no migration-pending block exists here)", () => {
    const src = source("app/dashboard/sops/page.tsx");
    expect(src).toContain(
      'role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18]',
    );
    expect(src).toContain(
      'role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6 text-[13px] text-zinc-300">',
    );
  });

  it("connector-setup page announces all 5 of its error states (network, migration, auth, generic, and action error)", () => {
    const src = source("app/dashboard/connector-setup/page.tsx");
    expect([...src.matchAll(/role="alert" aria-live="assertive"/g)]).toHaveLength(5);
  });
});
