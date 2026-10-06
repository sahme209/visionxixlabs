/**
 * Third sitewide sweep variant: these 13 pages matched the
 * networkError/errorBody grep but had a single-line div shape
 * (`<div className="...">{networkError}</div>` on one line, with
 * varying margin classes) instead of the two-line shape the second
 * sweep (networkErrorBodyAnnouncement.test.ts) fixed — so they were
 * left unverified by that batch too. Same defect, same fix: every
 * rose/amber-tinted error/warning banner in these files gets
 * role="alert" aria-live="assertive".
 *
 * agi-memory/page.tsx additionally had one banner with a reordered
 * className ("mb-4 rounded-2xl..." instead of "rounded-2xl...") in a
 * separate inline component — caught by manual review, not the
 * automated regex, and fixed by hand.
 *
 * Source-text assertion, not a render test — see
 * providersReducedMotion.test.ts for why.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FILES_WITH_EXPECTED_BANNER_COUNT: Array<[string, number]> = [
  ["app/dashboard/releaseops-autonomy/page.tsx", 3],
  ["app/dashboard/releases/[id]/page.tsx", 2],
  ["app/dashboard/releases/[id]/branch/page.tsx", 2],
  ["app/dashboard/agi-memory/page.tsx", 4],
  ["app/dashboard/agi-suggestions/page.tsx", 3],
  ["app/dashboard/agi-cockpit/page.tsx", 3],
  ["app/dashboard/incident-triage/page.tsx", 3],
  ["app/dashboard/policy-proposals/page.tsx", 3],
  ["app/dashboard/learning-loop/page.tsx", 2],
  ["app/dashboard/slack-notifications/page.tsx", 2],
  ["app/dashboard/ai-call-log/page.tsx", 2],
  ["app/dashboard/remediation-proposals/page.tsx", 3],
  ["app/dashboard/advisor-council/page.tsx", 3],
];

function source(path: string): string {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
}

describe("networkError/errorBody announcement — single-line variant", () => {
  it.each(FILES_WITH_EXPECTED_BANNER_COUNT)("%s announces all %i of its error/warning banners", (path, expected) => {
    const src = source(path);
    const matches = [...src.matchAll(/role="alert" aria-live="assertive"/g)];
    expect(matches).toHaveLength(expected);
  });
});
