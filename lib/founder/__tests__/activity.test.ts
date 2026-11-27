import { describe, expect, it } from "vitest";
import { ACTIVITY_KINDS, ACTIVITY_SIGNAL, activityBySignal, liveness, mergeActivity, timeAgo, type ActivityEvent } from "../activity";

const e = (id: string, at: string, signal: ActivityEvent["signal"] = "deployments_7d"): ActivityEvent => ({ id, kind: "deployment_started", at, signal, title: "t", detail: "d", tone: "running" });
const NOW = Date.parse("2026-11-27T12:00:00Z");

describe("founder activity", () => {
  it("maps every kind to a signal", () => { for (const k of ACTIVITY_KINDS) expect(ACTIVITY_SIGNAL[k]).toBeTruthy(); });
  it("merges newest first, keeps the first copy of an id and caps the list", () => {
    const merged = mergeActivity([e("a", "2026-11-27T10:00:00Z"), e("b", "2026-11-27T11:00:00Z")], [e("a", "2026-11-27T10:00:00Z"), e("c", "2026-11-27T11:30:00Z")]);
    expect(merged.map((x) => x.id)).toEqual(["c", "b", "a"]);
    expect(mergeActivity([], [e("a", "2026-11-27T10:00:00Z"), e("b", "2026-11-27T11:00:00Z")], 1).map((x) => x.id)).toEqual(["b"]);
  });
  it("counts events per signal within the window and ignores far-future times", () => {
    const by = activityBySignal([e("a", "2026-11-27T11:55:00Z"), e("b", "2026-11-26T09:00:00Z"), e("c", "2026-11-27T11:00:00Z", "incidents_open"), e("d", "2026-11-28T12:00:00Z")], NOW, 86_400_000);
    expect(by.get("deployments_7d")).toEqual({ count: 1, latest: Date.parse("2026-11-27T11:55:00Z") });
    expect(by.get("incidents_open")?.count).toBe(1);
  });
  it("says how long ago and how live a step is", () => {
    expect(timeAgo("2026-11-27T11:59:40Z", NOW)).toBe("just now");
    expect(timeAgo("2026-11-27T11:56:00Z", NOW)).toBe("4 min ago");
    expect(timeAgo("2026-11-27T09:00:00Z", NOW)).toBe("3 h ago");
    expect(timeAgo("2026-11-25T12:00:00Z", NOW)).toBe("2 d ago");
    expect(liveness(NOW - 5 * 60_000, NOW)).toBe("pulse");
    expect(liveness(NOW - 3_600_000, NOW)).toBe("active");
    expect(liveness(NOW - 2 * 86_400_000, NOW)).toBe("quiet");
    expect(liveness(undefined, NOW)).toBe("quiet");
  });
});
