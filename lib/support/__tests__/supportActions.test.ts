import { describe, expect, it } from "vitest";
import { classifySupportAction, decideSupportAction, mayOffer, SUPPORT_ACTION_INFO, SUPPORT_ACTIONS } from "../supportActions";

describe("Ask Axiom governed actions", () => {
  it("offers only the fixed actions for matching questions", () => {
    expect(classifySupportAction("seal the audit log now")).toBe("seal_audit_log");
    expect(classifySupportAction("can you verify the audit log was not tampered with")).toBe("verify_audit_log");
    expect(classifySupportAction("are my seals intact?")).toBe("verify_audit_log");
    expect(classifySupportAction("how much does it cost")).toBeNull();
    expect(classifySupportAction("delete the audit log")).toBeNull();
  });

  it("requires an allowed role", () => {
    expect(decideSupportAction({ action: "seal_audit_log", role: "operator", confirmed: "seal_audit_log" })).toEqual({ ok: false, error: "role_not_allowed" });
    expect(decideSupportAction({ action: "seal_audit_log", role: null, confirmed: "seal_audit_log" })).toEqual({ ok: false, error: "role_not_allowed" });
    expect(decideSupportAction({ action: "verify_audit_log", role: "security_reviewer", confirmed: "verify_audit_log" }).ok).toBe(true);
    expect(decideSupportAction({ action: "seal_audit_log", role: "security_reviewer", confirmed: "seal_audit_log" }).ok).toBe(false);
  });

  it("binds confirmation to the exact action", () => {
    expect(decideSupportAction({ action: "seal_audit_log", role: "admin", confirmed: true })).toEqual({ ok: false, error: "confirmation_required" });
    expect(decideSupportAction({ action: "seal_audit_log", role: "admin", confirmed: "verify_audit_log" })).toEqual({ ok: false, error: "confirmation_required" });
    expect(decideSupportAction({ action: "seal_audit_log", role: "admin", confirmed: "seal_audit_log" }).ok).toBe(true);
  });

  it("rejects anything outside the closed set", () => {
    for (const action of ["delete_audit_log", "", null, 42, "SEAL_AUDIT_LOG"]) expect(decideSupportAction({ action, role: "owner", confirmed: action })).toEqual({ ok: false, error: "unknown_action" });
  });

  it("never offers a destructive effect and states it before confirmation", () => {
    for (const a of SUPPORT_ACTIONS) {
      expect(["read_only", "append"]).toContain(SUPPORT_ACTION_INFO[a].effect);
      expect(SUPPORT_ACTION_INFO[a].confirmText.length).toBeGreaterThan(40);
      expect(SUPPORT_ACTION_INFO[a].roles).not.toContain("finance_viewer");
    }
    expect(mayOffer("seal_audit_log", "admin")).toBe(true);
    expect(mayOffer("seal_audit_log", "operator")).toBe(false);
  });
});
