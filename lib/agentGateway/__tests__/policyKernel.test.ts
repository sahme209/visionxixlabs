import { describe, expect, it } from "vitest";
import { ACTION_KINDS, ENVIRONMENTS, evaluateGatewayPolicy, gatewayActionDigest, mayProceed, parseGatewayAction } from "../policyKernel";

const act = (actionKind: (typeof ACTION_KINDS)[number], environment: (typeof ENVIRONMENTS)[number] = "development") => ({ actionKind, environment, target: "acme/web", summary: "Change x" });

describe("agent gateway policy kernel", () => {
  it("allows low-risk work without approval", () => {
    for (const k of ["read", "code_change", "open_pull_request"] as const) expect(evaluateGatewayPolicy(act(k)).decision).toBe("allow");
    expect(evaluateGatewayPolicy(act("read", "production")).decision).toBe("require_approval");
  });

  it("requires approval for consequential actions, raised in production", () => {
    expect(evaluateGatewayPolicy(act("merge"))).toMatchObject({ decision: "require_approval", riskLevel: "medium" });
    expect(evaluateGatewayPolicy(act("merge", "production"))).toMatchObject({ decision: "require_approval", riskLevel: "high" });
    expect(evaluateGatewayPolicy(act("deploy", "staging"))).toMatchObject({ decision: "require_approval", riskLevel: "high" });
    expect(evaluateGatewayPolicy(act("code_change", "unknown")).decision).toBe("require_approval");
  });

  it("denies production secret reads and production deletes outright", () => {
    expect(evaluateGatewayPolicy(act("secret_access", "production")).decision).toBe("deny");
    expect(evaluateGatewayPolicy(act("delete_resource", "production")).decision).toBe("deny");
    expect(evaluateGatewayPolicy(act("delete_resource", "staging")).decision).toBe("require_approval");
  });

  it("gives every action kind and environment a decision with reasons", () => {
    for (const k of ACTION_KINDS) for (const e of ENVIRONMENTS) {
      const r = evaluateGatewayPolicy(act(k, e));
      expect(["allow", "require_approval", "deny"]).toContain(r.decision);
      expect(r.reasons.length).toBeGreaterThan(1);
    }
  });

  it("binds approval to the exact action, key and workspace", () => {
    const a = act("deploy", "production");
    const d = gatewayActionDigest("org", "key", a);
    expect(d).toMatch(/^[0-9a-f]{64}$/);
    expect(gatewayActionDigest("org", "key", a)).toBe(d);
    expect(gatewayActionDigest("org2", "key", a)).not.toBe(d);
    expect(gatewayActionDigest("org", "key2", a)).not.toBe(d);
    expect(gatewayActionDigest("org", "key", { ...a, summary: "Change y" })).not.toBe(d);
  });

  it("validates untrusted input", () => {
    expect(parseGatewayAction(null)).toEqual({ ok: false, error: "invalid_body" });
    expect(parseGatewayAction({ actionKind: "nuke", target: "x", summary: "y" })).toEqual({ ok: false, error: "invalid_action_kind" });
    expect(parseGatewayAction({ actionKind: "deploy", environment: "moon", target: "x", summary: "y" })).toEqual({ ok: false, error: "invalid_environment" });
    expect(parseGatewayAction({ actionKind: "deploy", target: "", summary: "y" })).toEqual({ ok: false, error: "invalid_target" });
    expect(parseGatewayAction({ actionKind: "deploy", target: "x", summary: "a\u0000b" })).toEqual({ ok: false, error: "invalid_summary" });
    expect(parseGatewayAction({ actionKind: "deploy", target: " x ", summary: "y" })).toEqual({ ok: true, value: { actionKind: "deploy", environment: "unknown", target: "x", summary: "y", agentName: "unnamed-agent" } });
  });

  it("only lets an agent proceed when allowed or approved and unexpired", () => {
    const now = new Date("2026-11-09T00:00:00Z"); const later = new Date("2026-11-10T00:00:00Z"); const earlier = new Date("2026-11-08T00:00:00Z");
    expect(mayProceed({ status: "approved", policyDecision: "allow", expiresAt: later }, now)).toEqual({ proceed: true, reason: "allowed_by_policy" });
    expect(mayProceed({ status: "approved", policyDecision: "require_approval", expiresAt: later }, now)).toEqual({ proceed: true, reason: "approved" });
    expect(mayProceed({ status: "pending", policyDecision: "require_approval", expiresAt: later }, now)).toEqual({ proceed: false, reason: "awaiting_approval" });
    expect(mayProceed({ status: "approved", policyDecision: "require_approval", expiresAt: earlier }, now)).toEqual({ proceed: false, reason: "expired" });
    expect(mayProceed({ status: "rejected", policyDecision: "require_approval", expiresAt: later }, now).proceed).toBe(false);
    expect(mayProceed({ status: "rejected", policyDecision: "deny", expiresAt: later }, now)).toEqual({ proceed: false, reason: "denied_by_policy" });
    expect(mayProceed({ status: "completed", policyDecision: "allow", expiresAt: later }, now).proceed).toBe(true);
  });
});
