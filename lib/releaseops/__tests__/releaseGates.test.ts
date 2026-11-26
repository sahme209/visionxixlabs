import { describe, expect, it, vi } from "vitest";
import { changeWindowGate, commitGates } from "../releaseGates";
import type { DeploymentCheckGateRepo } from "../deploymentCheckGateStore";
import type { RingGateRepo } from "../ringGate";

const repo = (over: { checks?: unknown[]; results?: unknown[]; tags?: string[]; prevEnvs?: unknown[]; done?: number; fail?: boolean } = {}): DeploymentCheckGateRepo & RingGateRepo => ({
  deploymentCheck: { findMany: vi.fn(async () => { if (over.fail) throw new Error("db"); return over.checks ?? []; }) },
  deploymentCheckResult: { findMany: vi.fn(async () => over.results ?? []) },
  environment: { findFirst: vi.fn(async () => ({ tags: over.tags ?? [] })), findMany: vi.fn(async () => over.prevEnvs ?? []) },
  deploymentExecution: { count: vi.fn(async () => over.done ?? 0) },
}) as unknown as DeploymentCheckGateRepo & RingGateRepo;
const input = { organizationId: "o", environmentId: "e", repositoryFullName: "a/b", commitSha: "c".repeat(40), now: new Date("2026-11-26T12:00:00Z") };

describe("shared release gates", () => {
  it("applies change windows and freezes", () => {
    expect(changeWindowGate(null, input.now)).toEqual({ ok: true });
    expect(changeWindowGate({ utcWindows: "x" }, input.now)).toMatchObject({ ok: false, error: "change_window_unreadable" });
    expect(changeWindowGate({ freezes: [{ startUtc: "2026-11-26T00:00:00Z", endUtc: "2026-11-27T00:00:00Z", reason: "Peak" }] }, input.now)).toMatchObject({ ok: false, error: "deployment_freeze_active", freezeReason: "Peak" });
    expect(changeWindowGate({ weekdays: ["Mon"], utcWindows: [{ start: "01:00", end: "02:00" }] }, input.now)).toMatchObject({ ok: false, error: "outside_change_window", nextOpen: { startUtc: "2026-11-30T01:00:00.000Z" } });
  });
  it("passes with no checks and no ring, and fails closed when stores are unreadable", async () => {
    expect(await commitGates(repo(), input)).toEqual({ ok: true });
    expect(await commitGates(repo({ fail: true }), input)).toEqual({ ok: false, error: "deployment_checks_unavailable" });
  });
  it("blocks a later ring until the previous ring deployed the commit", async () => {
    expect(await commitGates(repo({ tags: ["ring:1"], prevEnvs: [{ id: "e0" }], done: 0 }), input)).toMatchObject({ ok: false, error: "previous_ring_not_deployed", ring: 1 });
    expect(await commitGates(repo({ tags: ["ring:1"], prevEnvs: [{ id: "e0" }], done: 1 }), input)).toEqual({ ok: true });
  });
});
