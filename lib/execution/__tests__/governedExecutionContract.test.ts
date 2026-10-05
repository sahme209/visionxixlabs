import { describe, expect, it, vi } from "vitest";
import {
  defaultDenyPrerequisites,
  evaluateGovernedExecutionPrerequisites,
  GOVERNED_EXECUTION_PREREQUISITE_ORDER,
  type GovernedExecutionPrerequisites,
} from "../governedExecutionContract";

type Ctx = { organizationId: string };

function allowAll(): GovernedExecutionPrerequisites<Ctx> {
  return {
    tenantAuthorization: vi.fn(async () => ({ ok: true })),
    roleCheck: vi.fn(async () => ({ ok: true })),
    explicitApproval: vi.fn(async () => ({ ok: true })),
    environmentSafeguard: vi.fn(async () => ({ ok: true })),
    immutableEvidence: vi.fn(async () => ({ ok: true })),
    rollbackAndValidation: vi.fn(async () => ({ ok: true })),
  };
}

describe("defaultDenyPrerequisites — the safe starting point", () => {
  it("fails every single prerequisite with a named reason", async () => {
    const result = await evaluateGovernedExecutionPrerequisites(defaultDenyPrerequisites<Ctx>(), { organizationId: "org-1" });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.failedPrerequisite).toBe("tenant_authorization");
      expect(result.reason).toContain("no real implementation wired");
    }
  });
});

describe("evaluateGovernedExecutionPrerequisites — ordering and short-circuit", () => {
  it("allows execution only when all six prerequisites pass", async () => {
    const result = await evaluateGovernedExecutionPrerequisites(allowAll(), { organizationId: "org-1" });
    expect(result.allowed).toBe(true);
  });

  it("checks prerequisites in the canonical order and stops at the first failure", async () => {
    const prereqs = allowAll();
    prereqs.explicitApproval = vi.fn(async () => ({ ok: false, reason: "no approval record found" }));

    const result = await evaluateGovernedExecutionPrerequisites(prereqs, { organizationId: "org-1" });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.failedPrerequisite).toBe("explicit_approval");
      expect(result.reason).toBe("no approval record found");
    }
    // Prerequisites after the failed one in canonical order must never run.
    expect(prereqs.environmentSafeguard).not.toHaveBeenCalled();
    expect(prereqs.immutableEvidence).not.toHaveBeenCalled();
    expect(prereqs.rollbackAndValidation).not.toHaveBeenCalled();
    // Prerequisites before it must have run.
    expect(prereqs.tenantAuthorization).toHaveBeenCalledTimes(1);
    expect(prereqs.roleCheck).toHaveBeenCalledTimes(1);
  });

  it("treats a thrown error identically to an explicit failure — never a silent pass", async () => {
    const prereqs = allowAll();
    prereqs.roleCheck = vi.fn(async () => { throw new Error("role lookup database error"); });

    const result = await evaluateGovernedExecutionPrerequisites(prereqs, { organizationId: "org-1" });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.failedPrerequisite).toBe("role_check");
      expect(result.reason).toBe("role lookup database error");
    }
    expect(prereqs.explicitApproval).not.toHaveBeenCalled();
  });

  it.each(GOVERNED_EXECUTION_PREREQUISITE_ORDER)("a failure at '%s' is reported as that exact prerequisite", async (name) => {
    const keyMap = {
      tenant_authorization: "tenantAuthorization",
      role_check: "roleCheck",
      explicit_approval: "explicitApproval",
      environment_safeguard: "environmentSafeguard",
      immutable_evidence: "immutableEvidence",
      rollback_and_validation: "rollbackAndValidation",
    } as const;
    const prereqs = allowAll();
    prereqs[keyMap[name]] = vi.fn(async () => ({ ok: false, reason: `${name} failed` }));

    const result = await evaluateGovernedExecutionPrerequisites(prereqs, { organizationId: "org-1" });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.failedPrerequisite).toBe(name);
  });
});
