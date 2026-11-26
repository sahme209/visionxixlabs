import { describe, expect, it } from "vitest";
import { stabilityWarning } from "../stabilityWarning";

const now = new Date("2026-11-26T12:00:00Z");
const day = (d: number) => new Date(now.getTime() - d * 86_400_000);
const rel = (id: string, status: string, daysAgo: number) => ({ id, status, actualDeployEnd: day(daysAgo) });
const baseline = Array.from({ length: 20 }, (_, i) => rel(`b${i}`, i === 0 ? "failed" : "deployed", 10 + i * 3)); // 5% baseline

describe("stability early warning", () => {
  it("needs enough recent releases before judging", () => {
    expect(stabilityWarning([...baseline, rel("r1", "failed", 1)], new Set(), now).level).toBe("insufficient_data");
  });
  it("stays steady when the recent rate matches the baseline", () => {
    const w = stabilityWarning([...baseline, rel("r1", "deployed", 1), rel("r2", "deployed", 2), rel("r3", "deployed", 3), rel("r4", "failed", 4)], new Set(), now);
    expect(w).toMatchObject({ level: "steady", recent: { finished: 4, failed: 1, ratePercent: 25 }, baseline: { finished: 20, failed: 1, ratePercent: 5 } });
  });
  it("raises a warning when recent failures, including incidents after deploys, jump above the baseline", () => {
    const recent = [rel("r1", "failed", 1), rel("r2", "rolled_back", 2), rel("r3", "deployed", 3), rel("r4", "deployed", 4), rel("r5", "deployed", 5)];
    const w = stabilityWarning([...baseline, ...recent], new Set(["r3"]), now);
    expect(w.level).toBe("elevated");
    expect(w.recent).toEqual({ finished: 5, failed: 3, ratePercent: 60 });
    expect(w.message).toMatch(/^3 of 5 releases in the last 7 days .* \(60%\), against 5% before\. Slow down/);
  });
  it("ignores unfinished releases and anything older than the baseline window", () => {
    const w = stabilityWarning([rel("old", "failed", 200), { id: "x", status: "deploying", actualDeployEnd: null }, rel("r1", "deployed", 1), rel("r2", "deployed", 1), rel("r3", "deployed", 1)], new Set(), now);
    expect(w).toMatchObject({ level: "steady", baseline: { finished: 0, ratePercent: null } });
  });
});

import { readStabilityWarning } from "../stabilityWarning";
import { vi } from "vitest";
describe("readStabilityWarning", () => {
  it("reads 97 days of releases scoped to the workspace and returns null on failure", async () => {
    const repo = { release: { findMany: vi.fn(async () => [rel("r1", "failed", 1), rel("r2", "failed", 1), rel("r3", "failed", 1)]) }, deploymentIncident: { findMany: vi.fn(async () => []) } };
    const w = await readStabilityWarning(repo, "org", now);
    expect(w?.level).toBe("elevated");
    expect((repo.release.findMany.mock.calls[0] as unknown as [{ where: unknown }])[0].where).toEqual({ organizationId: "org", actualDeployEnd: { gte: new Date(now.getTime() - 97 * 86_400_000) } });
    repo.release.findMany.mockRejectedValueOnce(new Error("db"));
    expect(await readStabilityWarning(repo, "org", now)).toBeNull();
  });
});
