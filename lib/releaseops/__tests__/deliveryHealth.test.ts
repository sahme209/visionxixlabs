import { describe, expect, it } from "vitest";
import { summarizeDeliveryHealth, type HealthRun } from "../deliveryHealth";

const NOW = new Date("2026-11-27T12:00:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000);
const run = (env: string, minAgo: number, status: string, conclusion: string | null = null, tookMin = 10): HealthRun => ({ environmentId: env, status, conclusion, createdAt: ago(minAgo), completedAt: status === "completed" ? ago(minAgo - tookMin) : null, lastObservedAt: null });
const envs = [{ id: "prod", name: "Production", displayOrder: 2 }, { id: "stg", name: "Staging", displayOrder: 1 }, { id: "dev", name: "Dev", displayOrder: 0 }];

describe("summarizeDeliveryHealth", () => {
  it("orders environments, and marks one with no recent runs idle", () => {
    const h = summarizeDeliveryHealth([run("stg", 60, "completed", "success")], envs, NOW);
    expect(h.map((e) => e.name)).toEqual(["Dev", "Staging", "Production"]);
    expect(h[0]).toMatchObject({ health: "idle", runs: 0, lastRunAt: null, successRate: null });
    expect(h[1]).toMatchObject({ health: "healthy", successRate: 100, medianMinutes: 10, lastOutcome: "succeeded" });
  });
  it("calls an environment failing when the last three finished runs failed", () => {
    const h = summarizeDeliveryHealth([run("prod", 10, "completed", "failure"), run("prod", 20, "completed", "timed_out"), run("prod", 30, "completed", "failure"), run("prod", 40, "completed", "success")], envs, NOW);
    expect(h[2]).toMatchObject({ health: "failing", reasons: ["The last 3 finished runs failed."], successRate: 25, lastOutcome: "failed" });
  });
  it("degrades for stuck and untracked runs and a low success rate, with reasons", () => {
    const h = summarizeDeliveryHealth([run("stg", 45, "queued"), run("stg", 200, "in_progress"), run("stg", 300, "tracking_unavailable"), run("stg", 400, "completed", "success"), run("stg", 500, "completed", "failure"), run("stg", 600, "completed", "success")], envs, NOW);
    expect(h[1].health).toBe("degraded");
    expect(h[1].stuck).toBe(2);
    expect(h[1].untracked).toBe(1);
    expect(h[1].reasons).toEqual(["2 runs look stuck (queued over 30 minutes or running over 2 hours).", "1 run lost tracking.", "67% of finished runs succeeded."]);
    expect(h[1].lastOutcome).toBe("running");
  });
  it("ignores runs older than 30 days", () => {
    expect(summarizeDeliveryHealth([run("dev", 31 * 1440, "completed", "failure")], envs, NOW)[0].health).toBe("idle");
  });
});

describe("formatRunMinutes", () => {
  it("uses minutes, hours or days", async () => {
    const { formatRunMinutes } = await import("../deliveryHealth");
    expect(formatRunMinutes(12.4)).toBe("12 min");
    expect(formatRunMinutes(190)).toBe("3.2 h");
    expect(formatRunMinutes(18727)).toBe("13 d");
  });
});
