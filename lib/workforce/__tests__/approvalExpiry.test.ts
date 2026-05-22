import { describe, it, expect } from "vitest";
import {
  isApprovalExpired,
  resolveApprovalTtlMs,
  DEFAULT_APPROVAL_TTL_MS,
  MIN_APPROVAL_TTL_MS,
  MAX_APPROVAL_TTL_MS,
} from "../approvalExpiry";

const baseSnapshot = (status: string, createdAtIso: string) => ({
  status,
  createdAt: new Date(createdAtIso),
});

describe("isApprovalExpired", () => {
  const now = new Date("2026-05-22T12:00:00Z");

  it("pending and older than TTL → expired", () => {
    const s = baseSnapshot("pending", "2026-05-21T11:00:00Z");
    expect(isApprovalExpired(s, now)).toBe(true);
  });

  it("pending and just barely under TTL → NOT expired", () => {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const s = baseSnapshot("pending", oneHourAgo.toISOString());
    expect(isApprovalExpired(s, now)).toBe(false);
  });

  it("pending and exactly at TTL → expired (inclusive)", () => {
    const exactlyTtl = new Date(now.getTime() - DEFAULT_APPROVAL_TTL_MS);
    const s = baseSnapshot("pending", exactlyTtl.toISOString());
    expect(isApprovalExpired(s, now)).toBe(true);
  });

  it("approved row → never expires even if old", () => {
    const s = baseSnapshot("approved", "2020-01-01T00:00:00Z");
    expect(isApprovalExpired(s, now)).toBe(false);
  });

  it("rejected row → never expires even if old", () => {
    const s = baseSnapshot("rejected", "2020-01-01T00:00:00Z");
    expect(isApprovalExpired(s, now)).toBe(false);
  });

  it("already expired row → not re-expired (status check defends)", () => {
    const s = baseSnapshot("expired", "2020-01-01T00:00:00Z");
    expect(isApprovalExpired(s, now)).toBe(false);
  });

  it("ttlMs below MIN bound → refuses to expire (defensive)", () => {
    const s = baseSnapshot("pending", "2020-01-01T00:00:00Z");
    expect(isApprovalExpired(s, now, MIN_APPROVAL_TTL_MS - 1)).toBe(false);
  });

  it("ttlMs above MAX bound → refuses to expire (defensive)", () => {
    const s = baseSnapshot("pending", "2020-01-01T00:00:00Z");
    expect(isApprovalExpired(s, now, MAX_APPROVAL_TTL_MS + 1)).toBe(false);
  });

  it("custom 1-hour TTL respects override", () => {
    const oneHourTtl = 60 * 60 * 1000;
    const ninetyMinAgo = new Date(now.getTime() - 90 * 60 * 1000);
    const s = baseSnapshot("pending", ninetyMinAgo.toISOString());
    expect(isApprovalExpired(s, now, oneHourTtl)).toBe(true);
  });
});

describe("resolveApprovalTtlMs", () => {
  it("undefined env → default", () => {
    expect(resolveApprovalTtlMs(undefined)).toBe(DEFAULT_APPROVAL_TTL_MS);
  });

  it("empty string → default", () => {
    expect(resolveApprovalTtlMs("")).toBe(DEFAULT_APPROVAL_TTL_MS);
  });

  it("non-numeric garbage → default (never refuses to run)", () => {
    expect(resolveApprovalTtlMs("forever")).toBe(DEFAULT_APPROVAL_TTL_MS);
  });

  it("negative value → default", () => {
    expect(resolveApprovalTtlMs("-1000")).toBe(DEFAULT_APPROVAL_TTL_MS);
  });

  it("value below MIN bound → default", () => {
    expect(resolveApprovalTtlMs(String(MIN_APPROVAL_TTL_MS - 1))).toBe(DEFAULT_APPROVAL_TTL_MS);
  });

  it("value above MAX bound → default", () => {
    expect(resolveApprovalTtlMs(String(MAX_APPROVAL_TTL_MS + 1))).toBe(DEFAULT_APPROVAL_TTL_MS);
  });

  it("valid in-bounds value → echoed back", () => {
    const sixHours = 6 * 60 * 60 * 1000;
    expect(resolveApprovalTtlMs(String(sixHours))).toBe(sixHours);
  });
});
