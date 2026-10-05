/**
 * Incident-response IO boundary — proves every hard rule from the file
 * header is actually enforced, not just documented: role authorization,
 * tenant-scoped lookups (a cross-tenant id is indistinguishable from a
 * nonexistent one), correlation-ID audit evidence on every write and
 * every denial, and that invalid/terminal-state transitions are
 * rejected by composing the already-tested pure kernel, not reimplemented
 * here.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.recordAudit }));

import {
  createIncident,
  listIncidents,
  transitionIncident,
  type IncidentRecordRepo,
  type IncidentRecordRow,
} from "../incidentRecordRepo";

class FakeRepo implements IncidentRecordRepo {
  rows: IncidentRecordRow[] = [];
  nextId = 1;
  incidentRecord = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const now = new Date("2026-01-01T00:00:00.000Z");
      const row = {
        id: `inc_${this.nextId++}`,
        description: null,
        detectedByUserId: null,
        mitigatedAt: null,
        resolvedAt: null,
        postmortemCompletedAt: null,
        postmortemUrl: null,
        createdAt: now,
        updatedAt: now,
        detectedAt: now,
        ...data,
      } as IncidentRecordRow;
      this.rows.push(row);
      return row;
    },
    findFirst: async ({ where }: { where: { id: string; organizationId: string } }) =>
      this.rows.find((r) => r.id === where.id && r.organizationId === where.organizationId) ?? null,
    findMany: async ({ where }: { where: { organizationId: string } }) =>
      this.rows.filter((r) => r.organizationId === where.organizationId),
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = this.rows.find((r) => r.id === where.id);
      if (!row) throw new Error("not found");
      Object.assign(row, data);
      return row;
    },
  };
}

const approver = { organizationId: "org-1", userId: "user-1", email: "owner@acme.test", roles: ["owner"] };
const unauthorized = { organizationId: "org-1", userId: "user-2", email: "viewer@acme.test", roles: ["read_only"] };

describe("createIncident", () => {
  let repo: FakeRepo;
  beforeEach(() => {
    vi.clearAllMocks();
    repo = new FakeRepo();
  });

  it("denies creation for a role with no incident-management authority — and audits the denial", async () => {
    const result = await createIncident(repo, unauthorized, { severity: "high", title: "Checkout outage" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("forbidden");
    expect(repo.rows).toHaveLength(0);
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "incident.action_denied", outcome: "blocked" }));
  });

  it("rejects an invalid severity value", async () => {
    // @ts-expect-error - deliberately invalid input, proving runtime validation exists beyond the type system
    const result = await createIncident(repo, approver, { severity: "sev1", title: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_severity");
    expect(repo.rows).toHaveLength(0);
  });

  it("creates at status detected, always includes the reporting org in affectedOrganizationIds, and audits with a correlation id", async () => {
    const result = await createIncident(repo, approver, { severity: "critical", title: "Checkout outage" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.incident.status).toBe("detected");
      expect(result.incident.affectedOrganizationIds).toContain("org-1");
      expect(result.correlationId).toBeTruthy();
    }
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "incident.created", outcome: "success" }));
  });

  it("does not duplicate the reporting org if the caller already listed it as affected", async () => {
    const result = await createIncident(repo, approver, { severity: "low", title: "x", affectedOrganizationIds: ["org-1", "org-2"] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const occurrences = result.incident.affectedOrganizationIds.filter((o) => o === "org-1").length;
      expect(occurrences).toBe(1);
    }
  });
});

describe("transitionIncident — tenant isolation and lifecycle enforcement", () => {
  let repo: FakeRepo;
  beforeEach(async () => {
    vi.clearAllMocks();
    repo = new FakeRepo();
    await createIncident(repo, approver, { severity: "high", title: "Checkout outage" });
    await repo.incidentRecord.create({ data: { organizationId: "org-2", status: "detected", severity: "high", title: "Other tenant's incident", affectedOrganizationIds: ["org-2"] } });
  });

  it("denies transition for a role with no incident-management authority", async () => {
    const result = await transitionIncident(repo, unauthorized, { incidentId: "inc_1", targetStatus: "investigating" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("forbidden");
  });

  it("a cross-tenant incident id is indistinguishable from a nonexistent one", async () => {
    const result = await transitionIncident(repo, approver, { incidentId: "inc_2", targetStatus: "investigating" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_found");
    // The other tenant's row must be completely untouched.
    const other = repo.rows.find((r) => r.id === "inc_2");
    expect(other?.status).toBe("detected");
  });

  it("rejects a transition that skips a required stage, via the pure kernel — and audits the denial", async () => {
    const result = await transitionIncident(repo, approver, { incidentId: "inc_1", targetStatus: "resolved" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_transition");
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "incident.action_denied" }));
  });

  it("applies a valid transition and audits it with from/to detail", async () => {
    const result = await transitionIncident(repo, approver, { incidentId: "inc_1", targetStatus: "investigating" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.incident.status).toBe("investigating");
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "incident.transitioned",
      detail: expect.objectContaining({ from: "detected", to: "investigating" }),
    }));
  });

  it("rejects any transition attempt once an incident reaches the terminal postmortem_complete state", async () => {
    await transitionIncident(repo, approver, { incidentId: "inc_1", targetStatus: "investigating" });
    await transitionIncident(repo, approver, { incidentId: "inc_1", targetStatus: "mitigated" });
    await transitionIncident(repo, approver, { incidentId: "inc_1", targetStatus: "resolved" });
    await transitionIncident(repo, approver, { incidentId: "inc_1", targetStatus: "postmortem_complete" });

    const result = await transitionIncident(repo, approver, { incidentId: "inc_1", targetStatus: "investigating" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("already_terminal");
  });
});

describe("listIncidents — tenant scoping", () => {
  it("never returns another organization's incidents", async () => {
    const repo = new FakeRepo();
    await createIncident(repo, approver, { severity: "low", title: "Mine" });
    await repo.incidentRecord.create({ data: { organizationId: "org-2", status: "detected", severity: "low", title: "Not mine", affectedOrganizationIds: ["org-2"] } });

    const result = await listIncidents(repo, approver);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.incidents).toHaveLength(1);
      expect(result.incidents[0].title).toBe("Mine");
    }
  });

  it("denies listing for a role with no incident-management authority", async () => {
    const repo = new FakeRepo();
    const result = await listIncidents(repo, unauthorized);
    expect(result.ok).toBe(false);
  });
});
