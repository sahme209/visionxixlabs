/**
 * Vitest unit tests for the pure offline-queue store.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  _clearQueueForTests, _resetNowForTests, _setNowForTests,
  drainQueue, enqueueOp, listQueuedOps, queueSize,
} from "../offlineQueueStore";

describe("offlineQueueStore", () => {
  beforeEach(() => {
    _clearQueueForTests();
    _resetNowForTests();
  });

  it("enqueues a fresh op", () => {
    const r = enqueueOp({ id: "o1", kind: "comment", targetId: "p1", payload: { msg: "hi" } });
    expect(r.enqueued).toBe(true);
    expect(queueSize()).toBe(1);
  });

  it("rejects duplicate approval_decision for same target", () => {
    enqueueOp({ id: "o1", kind: "approval_decision", targetId: "pkt-1", payload: { decision: "approved" } });
    const r = enqueueOp({ id: "o2", kind: "approval_decision", targetId: "pkt-1", payload: { decision: "approved" } });
    expect(r.enqueued).toBe(false);
    expect(r.reason).toBe("duplicate_target_for_kind");
    expect(r.conflictWithId).toBe("o1");
  });

  it("allows multiple comments on the same target", () => {
    enqueueOp({ id: "c1", kind: "comment", targetId: "pkt-1", payload: { msg: "a" } });
    const r = enqueueOp({ id: "c2", kind: "comment", targetId: "pkt-1", payload: { msg: "b" } });
    expect(r.enqueued).toBe(true);
  });

  it("listQueuedOps returns deep-copied entries", () => {
    enqueueOp({ id: "x", kind: "comment", targetId: "t", payload: { v: 1 } });
    const a = listQueuedOps()[0];
    (a.payload as Record<string, number>).v = 999;
    const b = listQueuedOps()[0];
    expect(b.payload.v).toBe(1);
  });

  it("drainQueue removes ops that succeed", async () => {
    enqueueOp({ id: "a", kind: "comment", targetId: "t", payload: {} });
    const results = await drainQueue(async () => ({ ok: true }));
    expect(results[0].ok).toBe(true);
    expect(queueSize()).toBe(0);
  });

  it("drainQueue keeps ops that fail + bumps attempts + records lastError", async () => {
    enqueueOp({ id: "a", kind: "comment", targetId: "t", payload: {} });
    const results = await drainQueue(async () => ({ ok: false, error: "boom" }));
    expect(results[0].ok).toBe(false);
    const live = listQueuedOps()[0];
    expect(live.attempts).toBe(1);
    expect(live.lastError).toBe("boom");
  });

  it("executor that throws is normalized to ok=false with the message", async () => {
    enqueueOp({ id: "a", kind: "comment", targetId: "t", payload: {} });
    const results = await drainQueue(async () => { throw new Error("nope"); });
    expect(results[0].ok).toBe(false);
    expect(results[0].error).toBe("nope");
  });

  it("queue_full when full of 200 entries", () => {
    for (let i = 0; i < 200; i++) {
      enqueueOp({ id: `o${i}`, kind: "comment", targetId: `t${i}`, payload: {} });
    }
    const r = enqueueOp({ id: "overflow", kind: "comment", targetId: "tN", payload: {} });
    expect(r.enqueued).toBe(false);
    expect(r.reason).toBe("queue_full");
  });

  it("enqueuedAt uses the supplied now()", () => {
    _setNowForTests(() => 42);
    enqueueOp({ id: "a", kind: "comment", targetId: "t", payload: {} });
    expect(listQueuedOps()[0].enqueuedAt).toBe(42);
  });
});
