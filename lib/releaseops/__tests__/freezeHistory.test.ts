import { describe, expect, it } from "vitest";
import { summarizeFreezeHistory } from "../freezeHistory";

const ev = (kind: string, at: string, detailJson: unknown) => ({ kind, createdAt: new Date(at), detailJson });
describe("freeze history", () => {
  it("lists freezes newest first with their source and counts", () => {
    const out = summarizeFreezeHistory([
      ev("environment.freeze", "2026-11-20T10:00:00Z", { source: "api_key", reason: "PD Q1X", environments: ["Prod"], endsAt: "2026-11-20T14:00:00Z" }),
      ev("environment.freeze_end", "2026-11-20T11:00:00Z", { source: "cockpit", reason: "PD Q1X", environments: ["Prod"] }),
      ev("release.gate_refused", "2026-11-20T12:00:00Z", {}),
    ]);
    expect(out.started).toBe(1);
    expect(out.ended).toBe(1);
    expect(out.entries).toEqual([
      { at: "2026-11-20T11:00:00.000Z", kind: "ended", reason: "PD Q1X", environments: ["Prod"], source: "cockpit", endsAt: null },
      { at: "2026-11-20T10:00:00.000Z", kind: "started", reason: "PD Q1X", environments: ["Prod"], source: "api_key", endsAt: "2026-11-20T14:00:00Z" },
    ]);
  });
  it("tolerates missing detail and caps the list but not the counts", () => {
    const many = Array.from({ length: 12 }, (_, i) => ev("environment.freeze", `2026-11-${String(i + 1).padStart(2, "0")}T00:00:00Z`, null));
    const out = summarizeFreezeHistory(many);
    expect(out.started).toBe(12);
    expect(out.entries).toHaveLength(10);
    expect(out.entries[0]).toMatchObject({ reason: "No reason recorded", environments: [], source: "unknown" });
  });
});
