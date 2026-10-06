/**
 * Sitewide sweep: 54 dashboard pages rendered their load/action error
 * state with no role="alert"/aria-live at all — the same gap already
 * found and fixed individually on signin/signup/contact, the floating
 * widgets, and a handful of settings/connect-cloud/billing/team pages.
 * A sitewide grep (`grep -rln "setError" app/dashboard`) found the
 * pattern was actually systemic: 49 pages shared one exact copy-pasted
 * amber error-panel className, plus 5 more with slightly different
 * markup (bare <p>/<span>, a rose-tinted variant, two instances in one
 * file). All 54 are fixed here in one batch.
 *
 * Source-text assertion, not a render test — see
 * providersReducedMotion.test.ts for why.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SITEWIDE_AMBER_PANEL_FILES = [
  "app/dashboard/help-suggestions/page.tsx",
  "app/dashboard/agi/page.tsx",
  "app/dashboard/cost-overview/page.tsx",
  "app/dashboard/tenant-insights/page.tsx",
  "app/dashboard/automation-boundaries/page.tsx",
  "app/dashboard/root-causes/page.tsx",
  "app/dashboard/decision-heatmap/page.tsx",
  "app/dashboard/ai-settings/page.tsx",
  "app/dashboard/finops/page.tsx",
  "app/dashboard/evidence/page.tsx",
  "app/dashboard/policy-previews/page.tsx",
  "app/dashboard/k8s-eol/page.tsx",
  "app/dashboard/graph/page.tsx",
  "app/dashboard/setup/page.tsx",
  "app/dashboard/runbooks/queue/page.tsx",
  "app/dashboard/runbooks/page.tsx",
  "app/dashboard/approval-packets/page.tsx",
  "app/dashboard/next-actions/page.tsx",
  "app/dashboard/desktop/releases/page.tsx",
  "app/dashboard/desktop/page.tsx",
  "app/dashboard/executive-summary/page.tsx",
  "app/dashboard/agent-activity/page.tsx",
  "app/dashboard/policies/page.tsx",
  "app/dashboard/desktop/intelligence/page.tsx",
  "app/dashboard/cloud-security/page.tsx",
  "app/dashboard/cicd/page.tsx",
  "app/dashboard/integrations/github/page.tsx",
  "app/dashboard/agent-proposals/page.tsx",
  "app/dashboard/cloudtrail/page.tsx",
  "app/dashboard/integrations/health/page.tsx",
  "app/dashboard/help-analytics/page.tsx",
  "app/dashboard/cost-explainer/page.tsx",
  "app/dashboard/autonomy/page.tsx",
  "app/dashboard/aws-services/page.tsx",
  "app/dashboard/risks/page.tsx",
  "app/dashboard/charter/page.tsx",
  "app/dashboard/readiness/page.tsx",
  "app/dashboard/containers/page.tsx",
  "app/dashboard/sources/page.tsx",
  "app/dashboard/outbound-digest/page.tsx",
  "app/dashboard/priorities/page.tsx",
  "app/dashboard/agent-bus/page.tsx",
  "app/dashboard/scp-simulator/page.tsx",
  "app/dashboard/network-topology/page.tsx",
  "app/dashboard/notifications/page.tsx",
  "app/dashboard/rationale/page.tsx",
  "app/dashboard/ai-usage/page.tsx",
  "app/dashboard/cloud-inventory/page.tsx",
  "app/dashboard/evidence-library/page.tsx",
];

function source(path: string): string {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
}

describe("Sitewide dashboard error announcement", () => {
  it.each(SITEWIDE_AMBER_PANEL_FILES)("%s announces its error panel", (path) => {
    const src = source(path);
    expect(src).toContain(
      'role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6',
    );
  });

  it("CommandCenterClient announces both of its error states", () => {
    const src = source("app/dashboard/command-center/CommandCenterClient.tsx");
    expect(src).toContain('role="alert" aria-live="assertive" className="text-[12px] text-zinc-300/90"');
    expect(src).toContain('role="alert" aria-live="assertive" className="px-5 py-4"');
  });

  it("the release playbook page announces its error", () => {
    const src = source("app/dashboard/releases/[id]/playbook/page.tsx");
    expect(src).toContain('role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18]');
  });

  it("resilience page announces its error", () => {
    const src = source("app/dashboard/resilience/page.tsx");
    expect(src).toContain('role="alert" aria-live="assertive" className="text-sm text-red-400 mt-3"');
  });

  it("BulkActions announces both its error and its success confirmation", () => {
    const src = source("app/dashboard/approvals/BulkActions.tsx");
    expect(src).toContain('role="status" aria-live="polite" className="text-[11px] text-emerald-300"');
    expect(src).toContain('role="alert" aria-live="assertive" className="text-[11px] text-rose-300"');
  });

  it("workflow-translator announces its error", () => {
    const src = source("app/dashboard/workflow-translator/page.tsx");
    expect(src).toContain('role="alert" aria-live="assertive" className="mt-3 text-[11px] font-mono text-rose-300"');
  });
});
