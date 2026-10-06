/**
 * Fourth sitewide sweep variant: the original 54-file batch grepped for
 * the literal substring `{error}`, which misses the equally common
 * `{error || "fallback"}` / `{error ?? "fallback"}` shapes — found via
 * `grep -rl "error ||\|error ??" app/dashboard`. Same defect, same fix.
 *
 * This also caught a different bug class in DisconnectButton.tsx: its
 * error message was exposed only via a `title` tooltip attribute on a
 * "retry" button — invisible to sighted keyboard users and unreliably
 * read by screen readers. Fixed by rendering the error as real visible
 * text with role="alert" alongside the retry button, not just a hover
 * tooltip.
 *
 * Source-text assertion, not a render test — see
 * providersReducedMotion.test.ts for why.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PLAYBOOK_SUBPAGES = [
  "app/dashboard/releases/[id]/playbook/execution/page.tsx",
  "app/dashboard/releases/[id]/playbook/closure/page.tsx",
  "app/dashboard/releases/[id]/playbook/risk/page.tsx",
  "app/dashboard/releases/[id]/playbook/evidence/page.tsx",
  "app/dashboard/releases/[id]/playbook/request/page.tsx",
  "app/dashboard/releases/[id]/playbook/playbook/page.tsx",
  "app/dashboard/releases/[id]/playbook/validation/page.tsx",
  "app/dashboard/releases/[id]/playbook/readiness/page.tsx",
  "app/dashboard/releases/[id]/playbook/approval/page.tsx",
];

function source(path: string): string {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
}

describe("Release playbook sub-pages — error announcement", () => {
  it.each(PLAYBOOK_SUBPAGES)("%s announces its load error", (path) => {
    const src = source(path);
    expect(src).toContain(
      'role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 text-[13px] text-zinc-300">',
    );
  });
});

describe("CommandCenterClient — remaining error-fallback states", () => {
  const src = source("app/dashboard/command-center/CommandCenterClient.tsx");

  it("announces the unified-state error", () => {
    expect(src).toContain('role="alert" aria-live="assertive" className="rounded-xl border border-zinc-700/30 bg-white/[0.02] p-5 mb-6"');
  });

  it("announces the production-readiness error", () => {
    expect(src).toContain('role="alert" aria-live="assertive" className="rounded-xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6"');
  });
});

describe("/dashboard/trust and /dashboard/surfaces — error announcement", () => {
  it("trust page announces its error", () => {
    const src = source("app/dashboard/trust/page.tsx");
    expect(src).toContain('role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-8"');
  });

  it("surfaces page announces its error", () => {
    const src = source("app/dashboard/surfaces/page.tsx");
    expect(src).toContain('role="alert" aria-live="assertive" className="relative p-6"');
  });
});

describe("RunScanButton + DisconnectButton — error announcement", () => {
  it("RunScanButton announces scan failure", () => {
    const src = source("app/dashboard/RunScanButton.tsx");
    expect(src).toContain('role="alert" aria-live="assertive" className="text-[12px] text-rose-300"');
  });

  it("DisconnectButton renders its error as real visible text, not just a hover title", () => {
    const src = source("app/dashboard/DisconnectButton.tsx");
    expect(src).toContain('role="alert" aria-live="assertive" className="text-[10px] font-mono text-rose-300"');
    expect(src).not.toContain('title={error ?? undefined}');
  });
});
