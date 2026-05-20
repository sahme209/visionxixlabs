/**
 * Vitest unit tests for the pure observability log aggregator.
 */

import { describe, it, expect } from "vitest";
import { aggregateLogs, type LogRecord } from "../logAggregator";

const R = (service: string, level: LogRecord["level"], message: string, durationMs?: number, ts = "2026-05-20T01:00:00Z"): LogRecord =>
  ({ ts, service, level, message, durationMs });

describe("logAggregator", () => {
  it("empty input → null window + no services", () => {
    const r = aggregateLogs([]);
    expect(r.windowStart).toBeNull();
    expect(r.services).toEqual([]);
  });

  it("tracks earliest + latest ts as window", () => {
    const r = aggregateLogs([
      R("svc", "info", "hi", undefined, "2026-05-20T03:00:00Z"),
      R("svc", "info", "ho", undefined, "2026-05-20T01:00:00Z"),
    ]);
    expect(r.windowStart).toBe("2026-05-20T01:00:00Z");
    expect(r.windowEnd).toBe("2026-05-20T03:00:00Z");
  });

  it("error rate >=10% → burning verdict", () => {
    const records: LogRecord[] = [];
    for (let i = 0; i < 9; i++) records.push(R("svc", "info", "ok"));
    for (let i = 0; i < 2; i++) records.push(R("svc", "error", "boom"));
    const r = aggregateLogs(records);
    expect(r.services[0].verdict).toBe("burning");
  });

  it("error rate 2-10% → degraded", () => {
    const records: LogRecord[] = [];
    for (let i = 0; i < 95; i++) records.push(R("svc", "info", "ok"));
    for (let i = 0; i < 5; i++) records.push(R("svc", "error", "boom"));
    const r = aggregateLogs(records);
    expect(r.services[0].verdict).toBe("degraded");
  });

  it("error rate < 2% → ok", () => {
    const records: LogRecord[] = [];
    for (let i = 0; i < 100; i++) records.push(R("svc", "info", "ok"));
    for (let i = 0; i < 1; i++) records.push(R("svc", "error", "boom"));
    const r = aggregateLogs(records);
    expect(r.services[0].verdict).toBe("ok");
  });

  it("p50 and p95 latency computed from durationMs", () => {
    const records: LogRecord[] = [];
    for (let i = 1; i <= 100; i++) records.push(R("svc", "info", "ok", i));
    const r = aggregateLogs(records);
    // Quantile uses floor(N*q) → p50 lands near 51, p95 near 96. Loose tolerance.
    expect(r.services[0].p50LatencyMs).toBeGreaterThanOrEqual(50);
    expect(r.services[0].p50LatencyMs).toBeLessThanOrEqual(52);
    expect(r.services[0].p95LatencyMs).toBeGreaterThanOrEqual(95);
    expect(r.services[0].p95LatencyMs).toBeLessThanOrEqual(97);
  });

  it("top error fingerprints group by message prefix", () => {
    const r = aggregateLogs([
      R("svc", "error", "db connection refused for tenant-1"),
      R("svc", "error", "db connection refused for tenant-2"),
      R("svc", "error", "payment gateway timeout"),
    ]);
    const top = r.services[0].topErrorFingerprints;
    expect(top[0].count).toBe(2);
    expect(top[0].example).toContain("db connection refused");
  });

  it("services sorted burning → degraded → ok", () => {
    const records: LogRecord[] = [];
    // Clean service
    for (let i = 0; i < 100; i++) records.push(R("clean", "info", "ok"));
    // Burning service
    for (let i = 0; i < 50; i++) records.push(R("hot", "info", "ok"));
    for (let i = 0; i < 50; i++) records.push(R("hot", "error", "boom"));
    const r = aggregateLogs(records);
    expect(r.services[0].service).toBe("hot");
    expect(r.services[1].service).toBe("clean");
  });

  it("byLevel split across debug/info/warn/error/fatal", () => {
    const r = aggregateLogs([
      R("svc", "debug", "d"),
      R("svc", "info",  "i"),
      R("svc", "warn",  "w"),
      R("svc", "error", "e"),
      R("svc", "fatal", "f"),
    ]);
    const lvl = r.services[0].byLevel;
    expect(lvl).toEqual({ debug: 1, info: 1, warn: 1, error: 1, fatal: 1 });
  });
});
