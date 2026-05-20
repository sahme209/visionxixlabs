/**
 * Vitest unit tests for the pure secret-rotation tracker.
 */

import { describe, it, expect } from "vitest";
import { trackSecretRotation, type SecretRecord } from "../secretRotationTracker";

const NOW = "2026-05-20T00:00:00.000Z";

const SEC = (id: string, lastRotatedAt: string, maxAgeDays = 90, label = id): SecretRecord =>
  ({ id, label, lastRotatedAt, maxAgeDays });

describe("secretRotationTracker", () => {
  it("empty input → zero counts, nextActionDueAt null", () => {
    const r = trackSecretRotation({ secrets: [], now: NOW });
    expect(r.rows.length).toBe(0);
    expect(r.nextActionDueAt).toBeNull();
  });

  it("recently-rotated secret → status ok", () => {
    const r = trackSecretRotation({
      secrets: [SEC("a", "2026-05-10T00:00:00.000Z", 90)],
      now: NOW,
    });
    expect(r.rows[0].status).toBe("ok");
    expect(r.rows[0].dueInDays).toBe(80);
  });

  it("due_soon when within 7 days of max age", () => {
    const r = trackSecretRotation({
      // rotated 85 days ago, maxAge 90 → 5 days remaining
      secrets: [SEC("a", "2026-02-24T00:00:00.000Z", 90)],
      now: NOW,
    });
    expect(r.rows[0].status).toBe("due_soon");
    expect(r.rows[0].dueInDays).toBe(5);
  });

  it("overdue when past max age", () => {
    const r = trackSecretRotation({
      secrets: [SEC("a", "2026-01-01T00:00:00.000Z", 90)],
      now: NOW,
    });
    expect(r.rows[0].status).toBe("overdue");
    expect(r.rows[0].dueInDays).toBeLessThan(0);
  });

  it("rows sorted by dueInDays asc (overdue first)", () => {
    const r = trackSecretRotation({
      secrets: [
        SEC("ok",   "2026-05-15T00:00:00.000Z", 90),
        SEC("over", "2026-01-01T00:00:00.000Z", 90),
        SEC("soon", "2026-02-24T00:00:00.000Z", 90),
      ],
      now: NOW,
    });
    expect(r.rows.map((x) => x.id)).toEqual(["over", "soon", "ok"]);
  });

  it("counts match status totals", () => {
    const r = trackSecretRotation({
      secrets: [
        SEC("a", "2026-05-15T00:00:00.000Z", 90),  // ok
        SEC("b", "2026-02-24T00:00:00.000Z", 90),  // due_soon
        SEC("c", "2026-01-01T00:00:00.000Z", 90),  // overdue
        SEC("d", "2026-01-01T00:00:00.000Z", 90),  // overdue
      ],
      now: NOW,
    });
    expect(r.okCount).toBe(1);
    expect(r.dueSoonCount).toBe(1);
    expect(r.overdueCount).toBe(2);
  });

  it("nextActionDueAt is earliest nextDueAt", () => {
    const r = trackSecretRotation({
      secrets: [
        SEC("a", "2026-05-15T00:00:00.000Z", 90),
        SEC("b", "2026-02-24T00:00:00.000Z", 90),
      ],
      now: NOW,
    });
    // b's nextDueAt should be earliest since it rotates first
    expect(r.nextActionDueAt).toBe(r.rows[0].nextDueAt);
  });

  it("nextDueAt = lastRotatedAt + maxAgeDays", () => {
    const r = trackSecretRotation({
      secrets: [SEC("a", "2026-05-01T00:00:00.000Z", 30)],
      now: NOW,
    });
    expect(r.rows[0].nextDueAt).toBe("2026-05-31T00:00:00.000Z");
  });
});
