import { expect, it } from "vitest";
import { incidentRecoveryMetrics } from "../incidentRecoveryMetrics";
const i = (status: string, reportedAt: string, mitigatedAt: string | null, resolvedAt: string | null) => ({ status, reportedAt, mitigatedAt, resolvedAt });
it("takes medians from recorded timestamps and counts the sample", () => {
  const m = incidentRecoveryMetrics([
    i("resolved", "2026-11-17T10:00:00Z", "2026-11-17T10:20:00Z", "2026-11-17T12:00:00Z"),
    i("mitigated", "2026-11-17T09:00:00Z", "2026-11-17T09:40:00Z", null),
    i("open", "2026-11-17T08:00:00Z", null, null),
  ]);
  expect(m).toEqual({ open: 1, mitigate: { medianSeconds: 1800, count: 2 }, resolve: { medianSeconds: 7200, count: 1 } });
});
it("ignores missing or inverted times instead of guessing", () => {
  const m = incidentRecoveryMetrics([i("resolved", "2026-11-17T10:00:00Z", "2026-11-17T09:00:00Z", "bad")]);
  expect(m.mitigate).toEqual({ medianSeconds: null, count: 0 });
  expect(m.resolve).toEqual({ medianSeconds: null, count: 0 });
});
