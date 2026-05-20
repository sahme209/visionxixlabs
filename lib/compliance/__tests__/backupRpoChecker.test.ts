/**
 * Vitest unit tests for the pure backup/RPO compliance checker.
 */

import { describe, it, expect } from "vitest";
import { checkBackupCompliance, type BackupRun, type BackupTarget } from "../backupRpoChecker";

const NOW = "2026-05-20T12:00:00.000Z";

const TARGET = (id: string, rpoHours = 24): BackupTarget =>
  ({ resourceId: id, resourceLabel: id, rpoHours });

const RUN = (id: string, succeededAtIso: string): BackupRun =>
  ({ resourceId: id, succeededAtIso, sizeBytes: 1000 });

describe("backupRpoChecker", () => {
  it("no targets → ok severity, no rows", () => {
    const r = checkBackupCompliance({ targets: [], runs: [], nowIso: NOW });
    expect(r.rows.length).toBe(0);
    expect(r.severity).toBe("ok");
  });

  it("recent backup within RPO → ok", () => {
    const r = checkBackupCompliance({
      targets: [TARGET("db-prod", 24)],
      runs: [RUN("db-prod", "2026-05-20T08:00:00.000Z")],
      nowIso: NOW,
    });
    expect(r.rows[0].status).toBe("ok");
    expect(r.severity).toBe("ok");
  });

  it("within 80% of RPO → approaching", () => {
    const r = checkBackupCompliance({
      targets: [TARGET("db", 24)],
      runs: [RUN("db", "2026-05-19T11:30:00.000Z")], // ~24.5h ago - actually overdue
      nowIso: NOW,
    });
    // Try a clean approaching case: 20 hours ago, RPO=24 → 20/24 = 83% → approaching.
    const r2 = checkBackupCompliance({
      targets: [TARGET("db", 24)],
      runs: [RUN("db", "2026-05-19T16:00:00.000Z")], // 20h ago
      nowIso: NOW,
    });
    expect(r2.rows[0].status).toBe("approaching");
  });

  it("past RPO → overdue", () => {
    const r = checkBackupCompliance({
      targets: [TARGET("db", 24)],
      runs: [RUN("db", "2026-05-18T00:00:00.000Z")], // 60h ago
      nowIso: NOW,
    });
    expect(r.rows[0].status).toBe("overdue");
  });

  it("no runs → no_backups", () => {
    const r = checkBackupCompliance({
      targets: [TARGET("db", 24)],
      runs: [],
      nowIso: NOW,
    });
    expect(r.rows[0].status).toBe("no_backups");
    expect(r.severity).toBe("medium");
  });

  it("3+ overdue/no_backups → high severity", () => {
    const r = checkBackupCompliance({
      targets: [TARGET("a"), TARGET("b"), TARGET("c")],
      runs: [],
      nowIso: NOW,
    });
    expect(r.severity).toBe("high");
  });

  it("rows sorted no_backups → overdue → approaching → ok", () => {
    const r = checkBackupCompliance({
      targets: [TARGET("ok"), TARGET("over"), TARGET("none")],
      runs: [
        RUN("ok",   "2026-05-20T08:00:00.000Z"),
        RUN("over", "2026-05-18T00:00:00.000Z"),
      ],
      nowIso: NOW,
    });
    expect(r.rows.map((x) => x.resourceId)).toEqual(["none", "over", "ok"]);
  });

  it("takes most-recent run when multiple exist for a resource", () => {
    const r = checkBackupCompliance({
      targets: [TARGET("db", 24)],
      runs: [
        RUN("db", "2026-05-18T00:00:00.000Z"),
        RUN("db", "2026-05-20T11:00:00.000Z"),
      ],
      nowIso: NOW,
    });
    expect(r.rows[0].status).toBe("ok");
  });
});
