import { describe, it, expect } from "vitest";
import {
  parseIdempotencyKeyHeader,
  hashRequestBody,
  compareIdempotencyRecord,
} from "../idempotency";

const REF_NOW = new Date("2026-05-23T12:00:00Z");

describe("parseIdempotencyKeyHeader", () => {
  it("accepts a typical UUID v4", () => {
    const r = parseIdempotencyKeyHeader("9c5b94b1-35ad-49bb-b118-8e8fc24abf80");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.key).toBe("9c5b94b1-35ad-49bb-b118-8e8fc24abf80");
  });

  it("accepts a namespaced key", () => {
    expect(parseIdempotencyKeyHeader("ci_job:12345").ok).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const r = parseIdempotencyKeyHeader("  abc12345  ");
    if (r.ok) expect(r.key).toBe("abc12345");
  });

  it("rejects null / empty / whitespace-only", () => {
    expect(parseIdempotencyKeyHeader(null).ok).toBe(false);
    expect(parseIdempotencyKeyHeader("").ok).toBe(false);
    expect(parseIdempotencyKeyHeader("   ").ok).toBe(false);
  });

  it("rejects too-short keys", () => {
    const r = parseIdempotencyKeyHeader("abc");
    if (!r.ok) expect(r.reason).toBe("too_short");
  });

  it("rejects too-long keys (>255 chars)", () => {
    const r = parseIdempotencyKeyHeader("x".repeat(256));
    if (!r.ok) expect(r.reason).toBe("too_long");
  });

  it("rejects invalid characters (whitespace, quotes, semicolons)", () => {
    expect(parseIdempotencyKeyHeader("abc def123").ok).toBe(false);
    expect(parseIdempotencyKeyHeader("abc';--12").ok).toBe(false);
    expect(parseIdempotencyKeyHeader("abc<x>123").ok).toBe(false);
  });
});

describe("hashRequestBody", () => {
  it("returns a 64-char hex string", () => {
    const h = hashRequestBody('{"a":1}');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    expect(hashRequestBody("hello")).toBe(hashRequestBody("hello"));
  });

  it("differs across different inputs", () => {
    expect(hashRequestBody("a")).not.toBe(hashRequestBody("b"));
  });

  it("is byte-sensitive (whitespace matters)", () => {
    expect(hashRequestBody('{"a":1}')).not.toBe(hashRequestBody('{ "a": 1 }'));
  });
});

describe("compareIdempotencyRecord — no record", () => {
  it("returns no_record when stored is null", () => {
    const r = compareIdempotencyRecord({ stored: null, currentBodyHash: "h", now: REF_NOW });
    expect(r.kind).toBe("no_record");
  });
});

describe("compareIdempotencyRecord — replay", () => {
  it("returns replay_completed on matching hash + completed status", () => {
    const r = compareIdempotencyRecord({
      stored: {
        status: "completed",
        requestBodyHash: "h1",
        responseStatus: 202,
        responseBody: { ok: true, runId: "r1" },
        expiresAt: null,
      },
      currentBodyHash: "h1",
      now: REF_NOW,
    });
    expect(r.kind).toBe("replay_completed");
    expect(r.cachedResponse?.httpStatus).toBe(202);
    expect(r.cachedResponse?.body).toEqual({ ok: true, runId: "r1" });
  });

  it("replays failed outcomes too (the failure IS the canonical response)", () => {
    const r = compareIdempotencyRecord({
      stored: {
        status: "failed",
        requestBodyHash: "h",
        responseStatus: 400,
        responseBody: { ok: false, error: "missing_repo_ref" },
        expiresAt: null,
      },
      currentBodyHash: "h",
      now: REF_NOW,
    });
    expect(r.kind).toBe("replay_completed");
    expect(r.cachedResponse?.httpStatus).toBe(400);
  });
});

describe("compareIdempotencyRecord — conflicts", () => {
  it("returns in_flight when earlier call still processing", () => {
    const r = compareIdempotencyRecord({
      stored: {
        status: "in_flight",
        requestBodyHash: "h",
        responseStatus: null,
        responseBody: null,
        expiresAt: null,
      },
      currentBodyHash: "h",
      now: REF_NOW,
    });
    expect(r.kind).toBe("in_flight");
    expect(r.httpStatus).toBe(409);
  });

  it("returns body_mismatch when key reused with different body", () => {
    const r = compareIdempotencyRecord({
      stored: {
        status: "completed",
        requestBodyHash: "h1",
        responseStatus: 202,
        responseBody: { ok: true },
        expiresAt: null,
      },
      currentBodyHash: "h2",  // different
      now: REF_NOW,
    });
    expect(r.kind).toBe("body_mismatch");
    expect(r.httpStatus).toBe(422);
  });

  it("body_mismatch takes priority over in_flight (key reuse caught first)", () => {
    const r = compareIdempotencyRecord({
      stored: {
        status: "in_flight",
        requestBodyHash: "h1",
        responseStatus: null,
        responseBody: null,
        expiresAt: null,
      },
      currentBodyHash: "h2",
      now: REF_NOW,
    });
    expect(r.kind).toBe("body_mismatch");
  });
});

describe("compareIdempotencyRecord — expiration", () => {
  it("returns expired when expiresAt is in the past", () => {
    const r = compareIdempotencyRecord({
      stored: {
        status: "completed",
        requestBodyHash: "h",
        responseStatus: 202,
        responseBody: { ok: true },
        expiresAt: new Date("2026-05-22T00:00:00Z"),  // before REF_NOW
      },
      currentBodyHash: "h",
      now: REF_NOW,
    });
    expect(r.kind).toBe("expired");
  });

  it("does NOT expire when expiresAt is in the future", () => {
    const r = compareIdempotencyRecord({
      stored: {
        status: "completed",
        requestBodyHash: "h",
        responseStatus: 202,
        responseBody: { ok: true },
        expiresAt: new Date("2026-05-24T12:00:00Z"),
      },
      currentBodyHash: "h",
      now: REF_NOW,
    });
    expect(r.kind).toBe("replay_completed");
  });

  it("null expiresAt means never expires", () => {
    const r = compareIdempotencyRecord({
      stored: {
        status: "completed",
        requestBodyHash: "h",
        responseStatus: 202,
        responseBody: { ok: true },
        expiresAt: null,
      },
      currentBodyHash: "h",
      now: REF_NOW,
    });
    expect(r.kind).toBe("replay_completed");
  });
});

describe("compareIdempotencyRecord — sanity fallback", () => {
  it("treats completed-without-response as fresh", () => {
    const r = compareIdempotencyRecord({
      stored: {
        status: "completed",
        requestBodyHash: "h",
        responseStatus: null,
        responseBody: null,
        expiresAt: null,
      },
      currentBodyHash: "h",
      now: REF_NOW,
    });
    expect(r.kind).toBe("no_record");
  });
});
