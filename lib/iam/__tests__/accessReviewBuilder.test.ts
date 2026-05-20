/**
 * Vitest unit tests for the pure access-review builder.
 */

import { describe, it, expect } from "vitest";
import { buildAccessReview, type AccessGrant } from "../accessReviewBuilder";

const NOW = "2026-05-20T00:00:00.000Z";

const G = (userId: string, role: string, grantedAt: string, lastUsedAt: string | null, userLabel = userId): AccessGrant =>
  ({ userId, userLabel, role, grantedAt, lastUsedAt });

describe("accessReviewBuilder", () => {
  it("empty input → zero totals", () => {
    const r = buildAccessReview({ grants: [], now: NOW });
    expect(r.rows.length).toBe(0);
    expect(r.totals).toEqual({ keep: 0, revoke: 0, investigate: 0 });
  });

  it("recently used → keep", () => {
    const r = buildAccessReview({
      grants: [G("u1", "admin", "2026-01-01T00:00:00.000Z", "2026-05-10T00:00:00.000Z")],
      now: NOW,
    });
    expect(r.rows[0].recommendation).toBe("keep");
  });

  it("never used + granted < threshold ago → keep (new — give it time)", () => {
    const r = buildAccessReview({
      grants: [G("u1", "admin", "2026-05-01T00:00:00.000Z", null)],
      now: NOW,
    });
    expect(r.rows[0].recommendation).toBe("keep");
  });

  it("never used + granted >= threshold → investigate", () => {
    const r = buildAccessReview({
      grants: [G("u1", "admin", "2025-01-01T00:00:00.000Z", null)],
      now: NOW,
    });
    expect(r.rows[0].recommendation).toBe("investigate");
  });

  it("last used >= threshold ago → revoke", () => {
    const r = buildAccessReview({
      grants: [G("u1", "admin", "2025-01-01T00:00:00.000Z", "2025-06-01T00:00:00.000Z")],
      now: NOW,
    });
    expect(r.rows[0].recommendation).toBe("revoke");
  });

  it("respects custom unusedRevokeDays", () => {
    const r = buildAccessReview({
      grants: [G("u1", "admin", "2026-01-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z")],
      now: NOW,
      unusedRevokeDays: 30,
    });
    // Last used 49 days ago → exceeds 30-day threshold → revoke
    expect(r.rows[0].recommendation).toBe("revoke");
  });

  it("totals match recommendation counts", () => {
    const r = buildAccessReview({
      grants: [
        G("a", "admin", "2025-01-01T00:00:00.000Z", "2026-05-10T00:00:00.000Z"),    // keep
        G("b", "admin", "2025-01-01T00:00:00.000Z", "2025-06-01T00:00:00.000Z"),   // revoke
        G("c", "admin", "2025-01-01T00:00:00.000Z", null),                          // investigate
      ],
      now: NOW,
    });
    expect(r.totals).toEqual({ keep: 1, revoke: 1, investigate: 1 });
  });

  it("rows sorted: revoke → investigate → keep", () => {
    const r = buildAccessReview({
      grants: [
        G("a", "admin", "2025-01-01T00:00:00.000Z", "2026-05-10T00:00:00.000Z"),    // keep
        G("b", "admin", "2025-01-01T00:00:00.000Z", "2025-06-01T00:00:00.000Z"),   // revoke
        G("c", "admin", "2025-01-01T00:00:00.000Z", null),                          // investigate
      ],
      now: NOW,
    });
    expect(r.rows.map((x) => x.userId)).toEqual(["b", "c", "a"]);
  });
});
