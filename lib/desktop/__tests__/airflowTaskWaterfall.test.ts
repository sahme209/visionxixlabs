import { expect, it } from "vitest";
import { layoutWaterfall, taskTone } from "../airflowTaskWaterfall";
const t = (taskId: string, state: string | null, startedAt: string | null, endedAt: string | null) => ({ taskId, mapIndex: -1, state, startedAt, endedAt });
it("places tasks on a shared axis from recorded times only", () => {
  const { bars, spanSeconds } = layoutWaterfall([
    t("load", "success", "2026-11-17T10:01:00Z", "2026-11-17T10:03:00Z"),
    t("extract", "success", "2026-11-17T10:00:00Z", "2026-11-17T10:01:00Z"),
    t("publish", "running", "2026-11-17T10:03:00Z", null),
    t("notify", null, null, null),
  ]);
  expect(spanSeconds).toBe(180);
  expect(bars.map((b) => b.label)).toEqual(["extract", "load", "publish"]);
  expect(bars[0]).toMatchObject({ left: 0, seconds: 60, tone: "green" });
  expect(bars[1].left).toBeCloseTo(1 / 3);
  expect(bars[2]).toMatchObject({ open: true, seconds: null, tone: "blue" });
});
it("treats an end before the start as open, not negative", () => {
  const { bars } = layoutWaterfall([t("a", "failed", "2026-11-17T10:00:00Z", "2026-11-17T09:00:00Z")]);
  expect(bars[0]).toMatchObject({ open: true, tone: "red" });
});
it("maps Airflow states to status tones", () => {
  expect(taskTone("upstream_failed")).toBe("red");
  expect(taskTone("up_for_retry")).toBe("amber");
  expect(taskTone("skipped")).toBe("neutral");
});
