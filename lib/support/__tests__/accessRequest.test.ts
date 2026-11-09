import { describe, expect, it } from "vitest";
import { decideAccessRequest } from "../accessRequest";

describe("Ask Axiom access requests", () => {
  it("accepts an upgrade with a reason", () => {
    expect(decideAccessRequest({ requestedRole: "operator", reason: "I run staging deploys", currentRole: "read_only" })).toEqual({ ok: true, requestedRole: "operator", reason: "I run staging deploys" });
  });
  it("allows a peer role but never a downgrade or the same role", () => {
    expect(decideAccessRequest({ requestedRole: "security_reviewer", reason: "Reviewing audits", currentRole: "finance_viewer" }).ok).toBe(true);
    expect(decideAccessRequest({ requestedRole: "read_only", reason: "whatever", currentRole: "operator" })).toEqual({ ok: false, error: "already_has_role" });
    expect(decideAccessRequest({ requestedRole: "operator", reason: "whatever", currentRole: "operator" })).toEqual({ ok: false, error: "already_has_role" });
  });
  it("never offers owner and requires a real reason", () => {
    expect(decideAccessRequest({ requestedRole: "owner", reason: "please", currentRole: "admin" })).toEqual({ ok: false, error: "invalid_role" });
    expect(decideAccessRequest({ requestedRole: "admin", reason: " hi ", currentRole: "operator" })).toEqual({ ok: false, error: "reason_required" });
  });
});
