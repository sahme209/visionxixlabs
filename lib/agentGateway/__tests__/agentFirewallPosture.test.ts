import { describe, expect, it } from "vitest";
import { ALWAYS_ENFORCED, firewallPosture } from "../agentFirewallPosture";

const now = new Date("2026-11-26T12:00:00Z");
describe("agent firewall posture", () => {
  it("states the always-enforced rules", () => {
    expect(ALWAYS_ENFORCED.map((r) => r.id)).toEqual(["no-agent-credentials", "approved-exact-action", "same-release-gates", "no-production-secrets"]);
  });
  it("is clean for a well-configured workspace", () => {
    expect(firewallPosture({ now, apiKeys: [{ name: "cursor", scopes: ["governance:read", "governance:request"], expiresAt: new Date("2027-01-01"), revokedAt: null }], environments: [{ name: "Prod", tier: "prod", changeWindowRuleJson: { utcWindows: [] }, approvalPolicyId: "p1" }] })).toEqual([]);
  });
  it("flags broad keys, non-expiring agent keys and unguarded production, ignoring revoked and expired keys", () => {
    const findings = firewallPosture({ now, apiKeys: [
      { name: "ci-all", scopes: ["*"], expiresAt: null, revokedAt: null },
      { name: "old", scopes: ["pipeline:trigger"], expiresAt: null, revokedAt: new Date("2026-01-01") },
      { name: "expired", scopes: ["pipeline:*"], expiresAt: new Date("2026-01-01"), revokedAt: null },
      { name: "claude", scopes: ["governance:request"], expiresAt: null, revokedAt: null },
      { name: "bad-json", scopes: "x", expiresAt: null, revokedAt: null },
    ], environments: [{ name: "Prod EU", tier: "prod", changeWindowRuleJson: null, approvalPolicyId: null }, { name: "Dev", tier: "dev", changeWindowRuleJson: null, approvalPolicyId: null }] });
    expect(findings.map((f) => [f.id, f.subjects])).toEqual([
      ["broad-key", ["ci-all"]], ["agent-key-no-expiry", ["claude"]], ["prod-no-approval-policy", ["Prod EU"]], ["prod-no-change-window", ["Prod EU"]],
    ]);
  });
});
