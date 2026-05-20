/**
 * Vitest unit tests for the idempotency-key store.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  _clearIdempotencyStoreForTests, _resetNowForTests, _setNowForTests,
  idempotencyStoreSize, readIdempotencyKey, rememberIdempotencyKey,
} from "../idempotencyKeyStore";

describe("idempotencyKeyStore", () => {
  beforeEach(() => {
    _clearIdempotencyStoreForTests();
    _resetNowForTests();
  });

  it("first call → isNew=true", () => {
    const r = rememberIdempotencyKey({ scope: "webhook", key: "evt-1", resultHash: "h1" });
    expect(r.isNew).toBe(true);
  });

  it("duplicate call → isNew=false with previousResultHash", () => {
    rememberIdempotencyKey({ scope: "webhook", key: "evt-1", resultHash: "h1" });
    const r = rememberIdempotencyKey({ scope: "webhook", key: "evt-1", resultHash: "h2" });
    expect(r.isNew).toBe(false);
    expect(r.previousResultHash).toBe("h1");
  });

  it("scopes are independent", () => {
    rememberIdempotencyKey({ scope: "a", key: "evt-1", resultHash: "h1" });
    const r = rememberIdempotencyKey({ scope: "b", key: "evt-1", resultHash: "h2" });
    expect(r.isNew).toBe(true);
  });

  it("read returns entry or null", () => {
    rememberIdempotencyKey({ scope: "a", key: "evt-1", resultHash: "h1" });
    expect(readIdempotencyKey("a", "evt-1")?.resultHash).toBe("h1");
    expect(readIdempotencyKey("a", "evt-2")).toBeNull();
  });

  it("ttl expiry evicts old entries", () => {
    _setNowForTests(() => 0);
    rememberIdempotencyKey({ scope: "a", key: "evt-1", resultHash: "h1", ttlMs: 60_000 });
    _setNowForTests(() => 120_000);
    const second = rememberIdempotencyKey({ scope: "a", key: "evt-1", resultHash: "h2", ttlMs: 60_000 });
    expect(second.isNew).toBe(true);
  });

  it("ttlMs clamped to [60_000, 7 days]", () => {
    const r = rememberIdempotencyKey({ scope: "a", key: "k", resultHash: "h", ttlMs: 1 });
    expect(r.isNew).toBe(true);
  });

  it("idempotencyStoreSize reflects current count", () => {
    expect(idempotencyStoreSize()).toBe(0);
    rememberIdempotencyKey({ scope: "a", key: "k", resultHash: "h" });
    expect(idempotencyStoreSize()).toBe(1);
  });
});
