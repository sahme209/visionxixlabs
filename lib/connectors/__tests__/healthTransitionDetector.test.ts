/**
 * Pin every transition the cron + webhook contract depends on.
 *
 * Closed-union shape — if any of these break, the cron starts emitting
 * the wrong webhook events and the meaningfulness gate silently
 * mis-classifies a stable healthy connector as something worth paging
 * about.
 */

import { describe, expect, it } from "vitest";
import {
  detectTransitions,
  hasMeaningfulTransitions,
  type ConnectorStateRow,
} from "../healthTransitionDetector";

const row = (over: Partial<ConnectorStateRow>): ConnectorStateRow => ({
  name: "AWS",
  status: "healthy",
  reason: "Connector is syncing successfully.",
  ...over,
});

describe("detectTransitions", () => {
  it("emits no events when nothing changed", () => {
    const prev = [row({ status: "healthy" })];
    const curr = [row({ status: "healthy" })];
    expect(detectTransitions(prev, curr)).toEqual([]);
  });

  it("emits first_observed for a newly-seen connector", () => {
    const ts = detectTransitions([], [row({ status: "healthy" })]);
    expect(ts).toHaveLength(1);
    expect(ts[0]).toMatchObject({ kind: "first_observed", previousStatus: null, currentStatus: "healthy" });
  });

  it("emits degraded when healthy → anything non-healthy", () => {
    const ts = detectTransitions(
      [row({ status: "healthy" })],
      [row({ status: "stale", reason: "Last sync 10m ago." })],
    );
    expect(ts).toHaveLength(1);
    expect(ts[0]).toMatchObject({
      kind: "degraded",
      previousStatus: "healthy",
      currentStatus: "stale",
      reason: "Last sync 10m ago.",
    });
  });

  it("emits recovered when anything-non-healthy → healthy", () => {
    const ts = detectTransitions(
      [row({ status: "auth_failed" })],
      [row({ status: "healthy" })],
    );
    expect(ts[0]).toMatchObject({ kind: "recovered", previousStatus: "auth_failed", currentStatus: "healthy" });
  });

  it("emits status_changed when non-healthy → different non-healthy", () => {
    const ts = detectTransitions(
      [row({ status: "degraded" })],
      [row({ status: "stale" })],
    );
    expect(ts[0]).toMatchObject({ kind: "status_changed", previousStatus: "degraded", currentStatus: "stale" });
  });

  it("matches connectors by name; ignores prev-only rows", () => {
    const ts = detectTransitions(
      [row({ name: "AWS", status: "healthy" }), row({ name: "Azure", status: "healthy" })],
      [row({ name: "AWS", status: "stale" })], // Azure removed
    );
    expect(ts).toHaveLength(1);
    expect(ts[0].connectorName).toBe("AWS");
  });

  it("multiple connectors handled independently", () => {
    const ts = detectTransitions(
      [row({ name: "AWS", status: "healthy" }), row({ name: "Postgres", status: "healthy" })],
      [row({ name: "AWS", status: "auth_failed" }), row({ name: "Postgres", status: "stale" })],
    );
    expect(ts).toHaveLength(2);
    expect(ts.map((t) => t.connectorName).sort()).toEqual(["AWS", "Postgres"]);
  });
});

describe("hasMeaningfulTransitions", () => {
  it("first_observed of healthy alone is not meaningful (avoids cron-noise)", () => {
    const ts = detectTransitions([], [row({ status: "healthy" })]);
    expect(hasMeaningfulTransitions(ts)).toBe(false);
  });
  it("first_observed of non-healthy IS meaningful", () => {
    const ts = detectTransitions([], [row({ status: "auth_failed" })]);
    expect(hasMeaningfulTransitions(ts)).toBe(true);
  });
  it("any real transition is meaningful", () => {
    const ts = detectTransitions(
      [row({ status: "healthy" })],
      [row({ status: "stale" })],
    );
    expect(hasMeaningfulTransitions(ts)).toBe(true);
  });
  it("empty transition list is not meaningful", () => {
    expect(hasMeaningfulTransitions([])).toBe(false);
  });
});
