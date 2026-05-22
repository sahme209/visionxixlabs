import { describe, it, expect } from "vitest";
import { computeQuorumStatus, type QuorumDecision } from "../approvalQuorum";

const approve = (userId: string): QuorumDecision => ({ approverUserId: userId, decision: "approved" });
const reject  = (userId: string): QuorumDecision => ({ approverUserId: userId, decision: "rejected" });

describe("computeQuorumStatus", () => {
  it("requiredApprovers=1, no decisions → pending", () => {
    const r = computeQuorumStatus({ decisions: [], requiredApprovers: 1 });
    expect(r.status).toBe("pending");
    expect(r.approvedCount).toBe(0);
    expect(r.rejectedCount).toBe(0);
    expect(r.isTerminal).toBe(false);
  });

  it("requiredApprovers=1, one approve → approved (terminal)", () => {
    const r = computeQuorumStatus({ decisions: [approve("u1")], requiredApprovers: 1 });
    expect(r.status).toBe("approved");
    expect(r.approvedCount).toBe(1);
    expect(r.isTerminal).toBe(true);
    expect(r.approvedBy).toEqual(["u1"]);
  });

  it("requiredApprovers=2, one approve → still pending", () => {
    const r = computeQuorumStatus({ decisions: [approve("u1")], requiredApprovers: 2 });
    expect(r.status).toBe("pending");
    expect(r.approvedCount).toBe(1);
    expect(r.isTerminal).toBe(false);
  });

  it("requiredApprovers=2, two distinct approves → approved", () => {
    const r = computeQuorumStatus({
      decisions: [approve("u1"), approve("u2")],
      requiredApprovers: 2,
    });
    expect(r.status).toBe("approved");
    expect(r.approvedCount).toBe(2);
    expect(r.isTerminal).toBe(true);
    expect(r.approvedBy).toEqual(["u1", "u2"]);
  });

  it("requiredApprovers=2, two approves from SAME user → still pending (deduped)", () => {
    const r = computeQuorumStatus({
      decisions: [approve("u1"), approve("u1")],
      requiredApprovers: 2,
    });
    expect(r.status).toBe("pending");
    expect(r.approvedCount).toBe(1);
    expect(r.isTerminal).toBe(false);
  });

  it("requiredApprovers=2, one approve + one reject → rejected (reject short-circuits)", () => {
    const r = computeQuorumStatus({
      decisions: [approve("u1"), reject("u2")],
      requiredApprovers: 2,
    });
    expect(r.status).toBe("rejected");
    expect(r.isTerminal).toBe(true);
    expect(r.rejectedCount).toBe(1);
    expect(r.approvedCount).toBe(1);
  });

  it("requiredApprovers=2, single reject → rejected", () => {
    const r = computeQuorumStatus({
      decisions: [reject("u1")],
      requiredApprovers: 2,
    });
    expect(r.status).toBe("rejected");
    expect(r.isTerminal).toBe(true);
  });

  it("requiredApprovers=2, reject before any approve → rejected", () => {
    const r = computeQuorumStatus({
      decisions: [reject("u1"), approve("u2")],
      requiredApprovers: 2,
    });
    expect(r.status).toBe("rejected");
    expect(r.isTerminal).toBe(true);
  });

  it("requiredApprovers=0 defensive → approved immediately", () => {
    const r = computeQuorumStatus({ decisions: [], requiredApprovers: 0 });
    expect(r.status).toBe("approved");
    expect(r.isTerminal).toBe(true);
  });

  it("approvedBy returns sorted, deduped list", () => {
    const r = computeQuorumStatus({
      decisions: [approve("u_b"), approve("u_a"), approve("u_a")],
      requiredApprovers: 5,
    });
    expect(r.approvedBy).toEqual(["u_a", "u_b"]);
  });

  it("requiredApprovers=3, two approves → pending (under quorum)", () => {
    const r = computeQuorumStatus({
      decisions: [approve("u1"), approve("u2")],
      requiredApprovers: 3,
    });
    expect(r.status).toBe("pending");
    expect(r.approvedCount).toBe(2);
    expect(r.isTerminal).toBe(false);
  });
});
