/**
 * Vitest unit tests for the transient-error retry helper.
 *
 * Locks in: classifier coverage, max-attempts bound, permanent-error
 * fast-fail, attempt log shape.
 */

import { describe, it, expect } from "vitest";
import { isTransientError, retryTransient } from "../transientRetry";

describe("isTransientError classifier", () => {
  it("returns false for null / undefined", () => {
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
  });

  it("returns true for HTTP 429 / 5xx via SDK metadata shape", () => {
    expect(isTransientError({ $metadata: { httpStatusCode: 429 } })).toBe(true);
    expect(isTransientError({ $metadata: { httpStatusCode: 500 } })).toBe(true);
    expect(isTransientError({ $metadata: { httpStatusCode: 503 } })).toBe(true);
  });

  it("returns true for bare statusCode 5xx", () => {
    expect(isTransientError({ statusCode: 502 })).toBe(true);
  });

  it("returns false for 4xx auth/validation errors", () => {
    expect(isTransientError({ $metadata: { httpStatusCode: 400 } })).toBe(false);
    expect(isTransientError({ $metadata: { httpStatusCode: 401 } })).toBe(false);
    expect(isTransientError({ $metadata: { httpStatusCode: 403 } })).toBe(false);
  });

  it("returns true for known throttling error codes", () => {
    expect(isTransientError({ code: "ThrottlingException" })).toBe(true);
    expect(isTransientError({ code: "RequestThrottled" })).toBe(true);
    expect(isTransientError({ code: "ECONNRESET" })).toBe(true);
  });

  it("returns true for plain-string rate-exceeded errors", () => {
    expect(isTransientError(new Error("Rate exceeded for region us-east-1"))).toBe(true);
    expect(isTransientError(new Error("Too many requests"))).toBe(true);
    expect(isTransientError(new Error("Service unavailable"))).toBe(true);
  });

  it("returns false for arbitrary non-transient errors", () => {
    expect(isTransientError(new Error("Bucket does not exist"))).toBe(false);
    expect(isTransientError(new Error("ValidationError: name required"))).toBe(false);
  });
});

describe("retryTransient helper", () => {
  it("returns ok=true on first-attempt success", async () => {
    const r = await retryTransient(async () => 42);
    expect(r.ok).toBe(true);
    expect(r.value).toBe(42);
    expect(r.attempts.length).toBe(1);
    expect(r.attempts[0].errored).toBe(false);
  });

  it("retries on transient + succeeds on the next try", async () => {
    let n = 0;
    const r = await retryTransient<number>(async () => {
      n++;
      if (n < 2) throw Object.assign(new Error("Throttling"), { code: "ThrottlingException" });
      return 7;
    }, { baseDelayMs: 1, maxDelayMs: 5 });
    expect(r.ok).toBe(true);
    expect(r.value).toBe(7);
    expect(r.attempts.length).toBe(2);
  });

  it("fast-fails on permanent error (no retry attempts)", async () => {
    let n = 0;
    const r = await retryTransient(async () => {
      n++;
      throw new Error("ValidationError: bucket name required");
    }, { maxAttempts: 5, baseDelayMs: 1 });
    expect(r.ok).toBe(false);
    expect(n).toBe(1);
    expect(r.attempts.length).toBe(1);
  });

  it("exhausts retries when error stays transient", async () => {
    let n = 0;
    const r = await retryTransient(async () => {
      n++;
      throw Object.assign(new Error("Too many requests"), { statusCode: 429 });
    }, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 });
    expect(r.ok).toBe(false);
    expect(n).toBe(3);
    expect(r.attempts.length).toBe(3);
  });

  it("accepts a caller-supplied classifier", async () => {
    let n = 0;
    const r = await retryTransient(async () => {
      n++;
      throw new Error("CustomTransientFlavour");
    }, {
      maxAttempts: 3,
      baseDelayMs: 1,
      isTransient: (e) => e instanceof Error && /CustomTransientFlavour/.test(e.message),
    });
    expect(r.ok).toBe(false);
    expect(n).toBe(3);
  });
});
