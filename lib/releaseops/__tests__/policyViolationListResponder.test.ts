import { describe, expect, it } from "vitest";
import {
  buildPolicyViolationListResponse,
  type PolicyViolationListRepo,
  type ViolationRow,
} from "../policyViolationListResponder";

function makeRepo(): PolicyViolationListRepo & { _rows: ViolationRow[] } {
  const rows: ViolationRow[] = [];
  return {
    _rows: rows,
    policyViolation: {
      async findMany({ where, take }) {
        let filtered = rows.filter((r) => r.organizationId === where.organizationId);
        if (where.status) {
          const allowed = new Set(where.status.in);
          filtered = filtered.filter((r) => allowed.has(r.status as never));
        }
        const sorted = filtered.slice().sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
        return take ? sorted.slice(0, take) : sorted;
      },
    },
  };
}

function makeRow(over: Partial<ViolationRow> = {}): ViolationRow {
  return {
    id: "pv_1",
    organizationId: "o",
    ruleId: "r_1",
    releaseId: "rel_1",
    detectedAt: new Date("2026-05-22T10:00:00Z"),
    status: "open",
    message: "Missing approvals",
    remediation: "Have a second reviewer approve the PR",
    exceptionGrantedByUserId: null,
    exceptionGrantedAt: null,
    contextJson: null,
    rule: {
      key: "min_approvals",
      label: "Minimum approvals",
      severity: "blocker",
      blocking: true,
      exceptionAllowed: true,
    },
    ...over,
  };
}

const NOW = new Date("2026-05-25T12:00:00Z");

describe("buildPolicyViolationListResponse", () => {
  it("empty org → 200 ok, all buckets zeroed", async () => {
    const repo = makeRepo();
    const r = await buildPolicyViolationListResponse(repo, "o", { now: NOW });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.violations).toEqual([]);
    expect(r.body.data.summary.total).toBe(0);
    expect(r.body.data.summary.blockingOpen).toBe(0);
  });

  it("populated org — joins rule label + summary buckets", async () => {
    const repo = makeRepo();
    repo._rows.push(makeRow({ id: "v1" }));
    repo._rows.push(makeRow({ id: "v2", status: "exception_granted", detectedAt: new Date("2026-05-21T08:00:00Z"), rule: { key: "test_cov", label: "Test coverage", severity: "warning", blocking: false, exceptionAllowed: true } }));
    repo._rows.push(makeRow({ id: "v3", status: "resolved", detectedAt: new Date("2026-05-20T08:00:00Z"), rule: { key: "secrets", label: "Secret scan clean", severity: "advisory", blocking: false, exceptionAllowed: false } }));
    repo._rows.push(makeRow({ id: "v4", status: "weird", detectedAt: new Date("2026-05-19T08:00:00Z"), rule: { key: "x", label: "X", severity: "blocker", blocking: true, exceptionAllowed: false } }));

    const r = await buildPolicyViolationListResponse(repo, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.violations).toHaveLength(4);
    expect(r.body.data.violations[0].ruleLabel).toBe("Minimum approvals");
    expect(r.body.data.summary).toMatchObject({
      total: 4,
      blockingOpen: 1,
      byStatus: { open: 1, exception_pending: 0, exception_granted: 1, resolved: 1, unknown: 1 },
      bySeverity: { advisory: 1, warning: 1, blocker: 2, unknown: 0 },
    });
    // Unknown status narrowed to "unknown"
    expect(r.body.data.violations[3].status).toBe("unknown");
  });

  it("statusFilter narrows results", async () => {
    const repo = makeRepo();
    repo._rows.push(makeRow({ id: "v1", status: "open" }));
    repo._rows.push(makeRow({ id: "v2", status: "resolved" }));
    repo._rows.push(makeRow({ id: "v3", status: "exception_granted" }));
    const r = await buildPolicyViolationListResponse(repo, "o", { statusFilter: ["open", "exception_pending"] });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.violations).toHaveLength(1);
    expect(r.body.data.violations[0].id).toBe("v1");
  });

  it("take cap respected", async () => {
    const repo = makeRepo();
    for (let i = 0; i < 5; i++) {
      repo._rows.push(makeRow({ id: `v${i}`, detectedAt: new Date(2026, 4, 25 - i) }));
    }
    const r = await buildPolicyViolationListResponse(repo, "o", { take: 3 });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.violations).toHaveLength(3);
  });

  it("blockingOpen counts only blocking + status=open rows", async () => {
    const repo = makeRepo();
    repo._rows.push(makeRow({ id: "v1", status: "open", rule: { key: "a", label: "A", severity: "blocker", blocking: true, exceptionAllowed: true } }));
    repo._rows.push(makeRow({ id: "v2", status: "open", rule: { key: "b", label: "B", severity: "warning", blocking: false, exceptionAllowed: true } }));
    repo._rows.push(makeRow({ id: "v3", status: "resolved", rule: { key: "c", label: "C", severity: "blocker", blocking: true, exceptionAllowed: true } }));
    const r = await buildPolicyViolationListResponse(repo, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.summary.blockingOpen).toBe(1);
  });

  it("503 migration_pending when table missing", async () => {
    const repo = makeRepo();
    repo.policyViolation.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildPolicyViolationListResponse(repo, "o");
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
