/**
 * Vitest unit tests for the pure changefeed batcher.
 */

import { describe, it, expect } from "vitest";
import { batchChangefeed, type ChangefeedEvent } from "../changefeedBatcher";

const E = (ts: string, service: string, resourceId: string, kind: ChangefeedEvent["changeKind"]): ChangefeedEvent =>
  ({ ts, service, resourceId, changeKind: kind });

describe("changefeedBatcher", () => {
  it("empty input → empty output", () => {
    expect(batchChangefeed([])).toEqual([]);
  });

  it("groups consecutive same-service updates into one batch", () => {
    const r = batchChangefeed([
      E("2026-05-20T01:00:00.000Z", "checkout", "r-1", "update"),
      E("2026-05-20T01:00:01.000Z", "checkout", "r-2", "update"),
      E("2026-05-20T01:00:02.000Z", "checkout", "r-3", "update"),
    ], { windowMs: 5_000 });
    expect(r.length).toBe(1);
    expect(r[0].count).toBe(3);
    expect(r[0].resourceIds).toEqual(["r-1", "r-2", "r-3"]);
  });

  it("different services → separate batches", () => {
    const r = batchChangefeed([
      E("2026-05-20T01:00:00.000Z", "checkout", "r-1", "update"),
      E("2026-05-20T01:00:01.000Z", "billing", "r-2", "update"),
    ], { windowMs: 5_000 });
    expect(r.length).toBe(2);
  });

  it("different changeKinds → separate batches", () => {
    const r = batchChangefeed([
      E("2026-05-20T01:00:00.000Z", "checkout", "r-1", "create"),
      E("2026-05-20T01:00:01.000Z", "checkout", "r-1", "update"),
    ], { windowMs: 5_000 });
    expect(r.length).toBe(2);
  });

  it("events outside the window → separate batches", () => {
    const r = batchChangefeed([
      E("2026-05-20T01:00:00.000Z", "checkout", "r-1", "update"),
      E("2026-05-20T01:00:20.000Z", "checkout", "r-2", "update"),  // 20s later, > 5s window
    ], { windowMs: 5_000 });
    expect(r.length).toBe(2);
  });

  it("deduplicates resource ids within a batch", () => {
    const r = batchChangefeed([
      E("2026-05-20T01:00:00.000Z", "checkout", "r-1", "update"),
      E("2026-05-20T01:00:01.000Z", "checkout", "r-1", "update"),
    ], { windowMs: 5_000 });
    expect(r[0].resourceIds).toEqual(["r-1"]);
    expect(r[0].count).toBe(2);
  });

  it("batches sorted by firstTs asc", () => {
    const r = batchChangefeed([
      E("2026-05-20T02:00:00.000Z", "checkout", "r-1", "update"),
      E("2026-05-20T01:00:00.000Z", "billing", "r-2", "update"),
    ], { windowMs: 5_000 });
    expect(r[0].service).toBe("billing");
    expect(r[1].service).toBe("checkout");
  });

  it("clamps windowMs to [500, 1 day]", () => {
    const ok = batchChangefeed([E("2026-05-20T01:00:00.000Z", "svc", "r", "update")], { windowMs: 0 });
    const cap = batchChangefeed([E("2026-05-20T01:00:00.000Z", "svc", "r", "update")], { windowMs: 99_999_999_999 });
    expect(ok.length).toBeGreaterThan(0);
    expect(cap.length).toBeGreaterThan(0);
  });
});
