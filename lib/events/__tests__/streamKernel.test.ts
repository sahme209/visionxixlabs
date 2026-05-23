/**
 * Pin every closed-union edge of the streamKernel.
 *
 * If any of these tests fail the SSE contract has drifted — bytes on
 * the wire change, or the client's subscription is being interpreted
 * differently. Both are observable bugs.
 */

import { describe, expect, it } from "vitest";
import {
  formatSseFrame,
  isStreamEventKind,
  parseEventFilter,
  planTick,
  shouldEmit,
} from "../streamKernel";

describe("isStreamEventKind", () => {
  it("accepts every closed-union member", () => {
    for (const k of ["heartbeat", "approvals.snapshot", "connectors.snapshot", "stream.ready", "stream.shutdown"]) {
      expect(isStreamEventKind(k)).toBe(true);
    }
  });
  it("rejects unknown strings", () => {
    expect(isStreamEventKind("approvals.SNAPSHOT")).toBe(false); // case-sensitive
    expect(isStreamEventKind("pipeline.run_completed")).toBe(false); // belongs to webhook kinds, not stream
    expect(isStreamEventKind("")).toBe(false);
    expect(isStreamEventKind("*")).toBe(false); // wildcard isn't a real kind
  });
});

describe("parseEventFilter", () => {
  it("collapses null/empty to wildcard", () => {
    expect(parseEventFilter(null)).toBeNull();
    expect(parseEventFilter("")).toBeNull();
    expect(parseEventFilter(",,, ,")).toBeNull();
  });
  it("recognizes explicit wildcard", () => {
    expect(parseEventFilter("*")).toBeNull();
    expect(parseEventFilter("*,heartbeat")).toBeNull(); // * wins
  });
  it("returns a Set of valid members", () => {
    const f = parseEventFilter("heartbeat,approvals.snapshot");
    expect(f).toBeInstanceOf(Set);
    expect(Array.from(f as Set<string>).sort()).toEqual(["approvals.snapshot", "heartbeat"]);
  });
  it("silently drops unknown members but keeps valid ones", () => {
    const f = parseEventFilter("heartbeat,bogus,pipeline.run_started");
    expect(f).toBeInstanceOf(Set);
    expect(Array.from(f as Set<string>)).toEqual(["heartbeat"]);
  });
  it("entirely-invalid filter collapses to wildcard so clients see something", () => {
    expect(parseEventFilter("foo,bar,baz")).toBeNull();
  });
});

describe("shouldEmit", () => {
  it("wildcard filter emits everything", () => {
    expect(shouldEmit("heartbeat", null)).toBe(true);
    expect(shouldEmit("approvals.snapshot", null)).toBe(true);
  });
  it("explicit filter emits only its members", () => {
    const f = new Set<"heartbeat" | "approvals.snapshot">(["heartbeat"]) as ReadonlySet<"heartbeat" | "approvals.snapshot">;
    expect(shouldEmit("heartbeat", f)).toBe(true);
    expect(shouldEmit("approvals.snapshot", f as never)).toBe(false);
  });
});

describe("formatSseFrame", () => {
  it("produces RFC-shaped frames", () => {
    const frame = formatSseFrame({ kind: "heartbeat", data: { now: 1 } });
    // event: <kind>\n  data: <json>\n  \n  (trailing)
    expect(frame).toBe("event: heartbeat\ndata: {\"now\":1}\n\n");
  });
  it("includes id when supplied (Last-Event-ID resume)", () => {
    const frame = formatSseFrame({ kind: "approvals.snapshot", data: { count: 3 }, id: 42 });
    expect(frame).toBe('event: approvals.snapshot\ndata: {"count":3}\nid: 42\n\n');
  });
});

describe("planTick", () => {
  it("emits approvals snapshot every 5s", () => {
    expect(planTick(0).emitApprovalsSnapshot).toBe(true);
    expect(planTick(5).emitApprovalsSnapshot).toBe(true);
    expect(planTick(7).emitApprovalsSnapshot).toBe(false);
    expect(planTick(10).emitApprovalsSnapshot).toBe(true);
  });
  it("emits connectors snapshot every 30s", () => {
    expect(planTick(0).emitConnectorsSnapshot).toBe(true);
    expect(planTick(15).emitConnectorsSnapshot).toBe(false);
    expect(planTick(30).emitConnectorsSnapshot).toBe(true);
    expect(planTick(60).emitConnectorsSnapshot).toBe(true);
  });
  it("emits heartbeat every 25s (keep-alive for any intermediate proxy)", () => {
    expect(planTick(25).emitHeartbeat).toBe(true);
    expect(planTick(50).emitHeartbeat).toBe(true);
    expect(planTick(24).emitHeartbeat).toBe(false);
  });
});
