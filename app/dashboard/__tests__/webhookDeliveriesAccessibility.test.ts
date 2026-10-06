/**
 * /dashboard/webhook-deliveries uses `networkError`/`errorBody` instead
 * of the `error`/`setError` naming the sitewide sweep
 * (sitewideErrorAnnouncement.test.ts) grepped for — so it was missed by
 * that batch despite having the identical defect: three error states
 * with no role/aria-live at all. This is a reminder that the sitewide
 * sweep's grep was naming-convention-specific, not exhaustive; other
 * alternate-named error states likely still exist elsewhere (found via
 * `grep -rl "networkError\|errorBody\|loadError\|fetchError" app/dashboard`
 * — ~40 more candidate files, not yet individually verified).
 *
 * Source-text assertion, not a render test — see
 * providersReducedMotion.test.ts for why.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("../webhook-deliveries/page.tsx", import.meta.url), "utf8");

describe("/dashboard/webhook-deliveries — accessibility", () => {
  it("announces the network error", () => {
    expect(src).toContain('role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18]');
  });

  it("announces the migration-pending state", () => {
    expect(src).toContain('role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6">');
  });

  it("announces the auth-required state", () => {
    expect(src).toContain('role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6 text-[13px]');
  });
});
