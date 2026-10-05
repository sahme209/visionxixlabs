/**
 * Locks in the master AI on/off toggle added to /dashboard/ai-settings.
 * The backend (lib/ai/workspaceProviderPolicy.ts's `enabled` field,
 * already admin-gated via /api/account/ai-policy) existed before this
 * change; there was no visible UI control to actually flip it. This
 * wires a real toggle to the existing PUT endpoint — no new backend
 * surface, no new auth boundary (the PUT route's own admin gate is
 * unchanged and is the actual enforcement point; absence of
 * `adminPolicy` in the UI only hides the control for non-admins).
 *
 * Source-text assertion, not a render test — see
 * providersReducedMotion.test.ts for why.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("../page.tsx", import.meta.url), "utf8");

describe("/dashboard/ai-settings — master AI toggle", () => {
  it("fetches the admin-gated policy endpoint, not a new unauthenticated one", () => {
    expect(src).toContain('fetch("/api/account/ai-policy", { credentials: "include" })');
  });

  it("turning on sends every currently available provider, not a hardcoded list", () => {
    expect(src).toContain("allowedProviders: adminPolicy.availableProviders");
  });

  it("turning off clears providers, models, and fallback order together", () => {
    expect(src).toContain('{ enabled: false, allowedProviders: [], modelSelections: {}, fallbackOrder: [] }');
  });

  it("renders the toggle as a real switch with an accessible name, not a bare clickable div", () => {
    expect(src).toContain('role="switch"');
    expect(src).toContain("aria-checked={adminPolicy.policy.enabled}");
  });

  it("hides the toggle entirely for a non-admin instead of showing a disabled control", () => {
    // adminPolicy is null when the GET 403s (not an owner/admin) — the
    // toggle itself is only rendered when adminPolicy is truthy.
    expect(src).toContain("{adminPolicy && (");
    expect(src).toContain("Only a workspace owner or admin can change this setting.");
  });

  it("announces a toggle failure instead of failing silently", () => {
    expect(src).toContain('role="alert" aria-live="assertive"');
    expect(src).toContain("Could not update the AI setting.");
  });
});
