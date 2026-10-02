import { describe, expect, it } from "vitest";
import {
  buildInstallationCaptureResponse,
  buildInstallationStatusResponse,
  buildInstallationTransitionResponse,
  planInstallTransition,
  type GitHubInstallationRepo,
  type InstallationRow,
} from "../githubInstallationResponder";

interface Stub extends GitHubInstallationRepo {
  _rows: InstallationRow[];
  _nextId: number;
}

function makeRepo(): Stub {
  const stub: Stub = {
    _rows: [],
    _nextId: 1,
    gitHubInstallation: {
      async findUnique({ where }) {
        const k = where.organizationId_githubInstallationId;
        return stub._rows.find(
          (r) => r.organizationId === k.organizationId && r.githubInstallationId === k.githubInstallationId,
        ) ?? null;
      },
      async findFirst({ where }) {
        const out = stub._rows.filter((r) => {
          if (r.organizationId !== where.organizationId) return false;
          if (where.status && !where.status.in.includes(r.status as never)) return false;
          return true;
        }).sort((a, b) => b.installedAt.getTime() - a.installedAt.getTime());
        return out[0] ?? null;
      },
      async findMany({ where }) {
        return stub._rows
          .filter((r) => r.organizationId === where.organizationId)
          .sort((a, b) => b.installedAt.getTime() - a.installedAt.getTime());
      },
      async upsert({ where, create, update }) {
        const k = where.organizationId_githubInstallationId;
        const idx = stub._rows.findIndex(
          (r) => r.organizationId === k.organizationId && r.githubInstallationId === k.githubInstallationId,
        );
        if (idx >= 0) {
          const existing = stub._rows[idx];
          stub._rows[idx] = {
            ...existing,
            accountLogin: update.accountLogin,
            accountType: update.accountType,
            repositorySelection: update.repositorySelection,
            status: update.status,
            suspendedAt: update.suspendedAt,
            revokedAt: update.revokedAt,
            updatedAt: new Date(),
          };
          return stub._rows[idx];
        }
        const now = new Date();
        const row: InstallationRow = {
          id: `inst_${stub._nextId++}`,
          organizationId: create.organizationId,
          githubInstallationId: create.githubInstallationId,
          accountLogin: create.accountLogin,
          accountType: create.accountType,
          repositorySelection: create.repositorySelection,
          status: create.status,
          sourceFlow: create.sourceFlow,
          installedByUserId: create.installedByUserId,
          installedAt: new Date(now.getTime() + stub._rows.length),
          suspendedAt: null,
          revokedAt: null,
          lastSeenAt: null,
          createdAt: now,
          updatedAt: now,
        };
        stub._rows.push(row);
        return row;
      },
      async update({ where, data }) {
        const idx = stub._rows.findIndex((r) => r.id === where.id);
        if (idx < 0) throw new Error("not found");
        stub._rows[idx] = {
          ...stub._rows[idx],
          status: data.status,
          suspendedAt: data.suspendedAt !== undefined ? data.suspendedAt : stub._rows[idx].suspendedAt,
          revokedAt: data.revokedAt !== undefined ? data.revokedAt : stub._rows[idx].revokedAt,
          updatedAt: new Date(),
        };
        return stub._rows[idx];
      },
    },
  };
  return stub;
}

describe("planInstallTransition", () => {
  const ctx = { now: new Date("2026-05-26T12:00:00Z") };
  it("active → suspended on suspend", () => {
    const p = planInstallTransition("active", "suspend", ctx);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.next).toBe("suspended");
  });
  it("suspended → active on reactivate", () => {
    const p = planInstallTransition("suspended", "reactivate", ctx);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.next).toBe("active");
  });
  it("rejects reactivate from active", () => {
    expect(planInstallTransition("active", "reactivate", ctx).ok).toBe(false);
  });
  it("active → revoked on revoke", () => {
    const p = planInstallTransition("active", "revoke", ctx);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.next).toBe("revoked");
  });
  it("rejects revoke from revoked (terminal)", () => {
    expect(planInstallTransition("revoked", "revoke", ctx).ok).toBe(false);
  });
});

describe("buildInstallationCaptureResponse", () => {
  it("422 installation_id_required", async () => {
    const stub = makeRepo();
    const r = await buildInstallationCaptureResponse(stub, {
      organizationId: "o", githubInstallationId: "  ", accountLogin: "acme", accountType: "Organization",
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("installation_id_required");
  });

  it("422 account_login_required", async () => {
    const stub = makeRepo();
    const r = await buildInstallationCaptureResponse(stub, {
      organizationId: "o", githubInstallationId: "123", accountLogin: "", accountType: "Organization",
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("account_login_required");
  });

  it("422 account_type_invalid", async () => {
    const stub = makeRepo();
    const r = await buildInstallationCaptureResponse(stub, {
      organizationId: "o", githubInstallationId: "123", accountLogin: "acme", accountType: "Robot",
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("account_type_invalid");
  });

  it("201 first install captures + active by default", async () => {
    const stub = makeRepo();
    const r = await buildInstallationCaptureResponse(stub, {
      organizationId: "o", githubInstallationId: "12345", accountLogin: "acme",
      accountType: "Organization", repositorySelection: "all",
      installedByUserId: "u1",
    });
    expect(r.status).toBe(201);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.created).toBe(true);
    expect(r.body.data.installation.status).toBe("active");
    expect(r.body.data.installation.repositorySelection).toBe("all");
    expect(stub._rows[0].installedByUserId).toBe("u1");
  });

  it("200 idempotent re-install reactivates a suspended/revoked row", async () => {
    const stub = makeRepo();
    await buildInstallationCaptureResponse(stub, {
      organizationId: "o", githubInstallationId: "12345", accountLogin: "acme", accountType: "Organization",
    });
    // mutate to suspended
    stub._rows[0].status = "suspended";
    stub._rows[0].suspendedAt = new Date();
    const r = await buildInstallationCaptureResponse(stub, {
      organizationId: "o", githubInstallationId: "12345", accountLogin: "acme-renamed", accountType: "Organization",
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.created).toBe(false);
    expect(r.body.data.installation.status).toBe("active");
    expect(r.body.data.installation.accountLogin).toBe("acme-renamed");
    expect(stub._rows[0].suspendedAt).toBeNull();
  });

  it("503 migration_pending", async () => {
    const stub = makeRepo();
    stub.gitHubInstallation.findUnique = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildInstallationCaptureResponse(stub, {
      organizationId: "o", githubInstallationId: "1", accountLogin: "a", accountType: "User",
    });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});

describe("buildInstallationStatusResponse", () => {
  const installCtx = { appSlug: "axiom" };
  it("200 not installed when empty", async () => {
    const stub = makeRepo();
    const r = await buildInstallationStatusResponse(stub, "o", installCtx);
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.installed).toBe(false);
    expect(r.body.data.active).toBeNull();
    expect(r.body.data.installReady).toBe(true);
  });

  it("200 reports active installation when present", async () => {
    const stub = makeRepo();
    await buildInstallationCaptureResponse(stub, {
      organizationId: "o", githubInstallationId: "123", accountLogin: "acme", accountType: "Organization",
    });
    const r = await buildInstallationStatusResponse(stub, "o", installCtx);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.installed).toBe(true);
    expect(r.body.data.active?.accountLogin).toBe("acme");
  });

  it("200 falls back to history-only when no active row", async () => {
    const stub = makeRepo();
    await buildInstallationCaptureResponse(stub, {
      organizationId: "o", githubInstallationId: "123", accountLogin: "acme", accountType: "Organization",
    });
    stub._rows[0].status = "revoked";
    stub._rows[0].revokedAt = new Date();
    const r = await buildInstallationStatusResponse(stub, "o", installCtx);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.installed).toBe(false);
    expect(r.body.data.history).toHaveLength(1);
  });

  it("503 migration_pending", async () => {
    const stub = makeRepo();
    stub.gitHubInstallation.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildInstallationStatusResponse(stub, "o", installCtx);
    expect(r.status).toBe(503);
  });
});

describe("buildInstallationTransitionResponse", () => {
  async function seeded() {
    const stub = makeRepo();
    await buildInstallationCaptureResponse(stub, {
      organizationId: "o", githubInstallationId: "123", accountLogin: "acme", accountType: "Organization",
    });
    return stub;
  }

  it("200 suspend transitions to suspended", async () => {
    const stub = await seeded();
    const row = stub._rows[0];
    const r = await buildInstallationTransitionResponse(stub, {
      organizationId: "o", installationRowId: row.id, action: "suspend",
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.status).toBe("suspended");
  });

  it("404 installation_not_found", async () => {
    const stub = await seeded();
    const r = await buildInstallationTransitionResponse(stub, {
      organizationId: "o", installationRowId: "missing", action: "suspend",
    });
    expect(r.status).toBe(404);
  });

  it("409 illegal_transition reactivate from active", async () => {
    const stub = await seeded();
    const row = stub._rows[0];
    const r = await buildInstallationTransitionResponse(stub, {
      organizationId: "o", installationRowId: row.id, action: "reactivate",
    });
    expect(r.status).toBe(409);
  });
});
