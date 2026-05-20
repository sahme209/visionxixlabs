/**
 * Vitest unit tests for the pure GDPR DSR tracker.
 */

import { describe, it, expect } from "vitest";
import { trackDsrs, type DsrRecord, type SystemTrackerRow } from "../gdprDsrTracker";

const NOW = "2026-05-20T00:00:00Z";

const SYS = (systemId: string, status: SystemTrackerRow["status"] = "pending"): SystemTrackerRow =>
  ({ systemId, status, lastUpdatedIso: NOW });

const R = (overrides: Partial<DsrRecord> = {}): DsrRecord => ({
  id: "dsr-1",
  subjectId: "subj-abc",
  kind: "erasure",
  openedAtIso: "2026-05-10T00:00:00Z",
  identityVerified: true,
  extensionGranted: false,
  systems: [SYS("postgres-prod")],
  ...overrides,
});

describe("trackDsrs", () => {
  it("identity not verified → status=verifying", () => {
    const r = trackDsrs({ records: [R({ identityVerified: false })], nowIso: NOW });
    expect(r.rows[0].status).toBe("verifying");
  });

  it("verified + all systems completed → status=completed", () => {
    const r = trackDsrs({
      records: [R({ systems: [SYS("a", "completed"), SYS("b", "completed")] })],
      nowIso: NOW,
    });
    expect(r.rows[0].status).toBe("completed");
    expect(r.rows[0].ready).toBe(true);
  });

  it("any system blocked → status=blocked", () => {
    const r = trackDsrs({
      records: [R({ systems: [SYS("a", "completed"), SYS("b", "blocked")] })],
      nowIso: NOW,
    });
    expect(r.rows[0].status).toBe("blocked");
  });

  it("past 30-day deadline → status=overdue", () => {
    const r = trackDsrs({
      records: [R({ openedAtIso: "2026-04-01T00:00:00Z" })],
      nowIso: NOW,
    });
    expect(r.rows[0].status).toBe("overdue");
    expect(r.overdueCount).toBe(1);
  });

  it("extension granted → 60-day deadline", () => {
    const r = trackDsrs({
      records: [R({ openedAtIso: "2026-04-01T00:00:00Z", extensionGranted: true })],
      nowIso: NOW,
    });
    // 49 days elapsed, 60-day deadline → 11 days remaining → in_progress, not overdue.
    expect(r.rows[0].status).toBe("in_progress");
    expect(r.rows[0].daysRemaining).toBeGreaterThan(0);
  });

  it("no systems + verified → status=draft", () => {
    const r = trackDsrs({ records: [R({ systems: [] })], nowIso: NOW });
    expect(r.rows[0].status).toBe("draft");
  });

  it("daysRemaining can go negative when overdue", () => {
    const r = trackDsrs({
      records: [R({ openedAtIso: "2026-01-01T00:00:00Z" })],
      nowIso: NOW,
    });
    expect(r.rows[0].daysRemaining).toBeLessThan(0);
  });

  it("rows sorted overdue → blocked → verifying → draft → in_progress → completed", () => {
    const r = trackDsrs({
      records: [
        R({ id: "in_progress", systems: [SYS("a", "in_progress")] }),
        R({ id: "overdue",     openedAtIso: "2026-01-01T00:00:00Z" }),
        R({ id: "verifying",   identityVerified: false }),
      ],
      nowIso: NOW,
    });
    expect(r.rows.map((x) => x.id)).toEqual(["overdue", "verifying", "in_progress"]);
  });

  it("nextDeadlineIso = earliest open deadline", () => {
    const r = trackDsrs({
      records: [
        R({ id: "a", openedAtIso: "2026-05-01T00:00:00Z" }),
        R({ id: "b", openedAtIso: "2026-05-10T00:00:00Z" }),
      ],
      nowIso: NOW,
    });
    // a opened 19d ago + 30 → deadline 2026-05-31; b opened 10d ago + 30 → 2026-06-09.
    expect(r.nextDeadlineIso).toBe("2026-05-31T00:00:00.000Z");
  });
});
