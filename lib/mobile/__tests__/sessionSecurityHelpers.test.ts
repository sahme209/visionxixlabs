/**
 * Vitest unit tests for the pure mobile session-security helpers.
 */

import { describe, it, expect } from "vitest";
import {
  assessSession, shouldRefreshToken, shouldRequireBiometric,
  type BiometricPolicy, type SessionTokens,
} from "../sessionSecurityHelpers";

const POLICY: BiometricPolicy = {
  reauthEverySec: 300,
  alwaysRequireKinds: ["approval_decide"],
};

const TOKENS = (accessExpiresAtSec: number, refreshExpiresAtSec: number): SessionTokens => ({
  accessExpiresAtSec, refreshExpiresAtSec,
});

describe("shouldRefreshToken", () => {
  it("access expired → shouldRefresh true + access_expired", () => {
    const r = shouldRefreshToken({ tokens: TOKENS(0, 9999), nowSec: 100 });
    expect(r.shouldRefresh).toBe(true);
    expect(r.reason).toBe("access_expired");
    expect(r.secondsRemaining).toBe(0);
  });

  it("near expiry (<= 60s) → near_expiry", () => {
    const r = shouldRefreshToken({ tokens: TOKENS(150, 9999), nowSec: 100 });
    expect(r.shouldRefresh).toBe(true);
    expect(r.reason).toBe("near_expiry");
  });

  it("plenty of headroom → ok", () => {
    const r = shouldRefreshToken({ tokens: TOKENS(10_000, 99_999), nowSec: 100 });
    expect(r.shouldRefresh).toBe(false);
    expect(r.reason).toBe("ok");
  });
});

describe("shouldRequireBiometric", () => {
  it("action always_required → required regardless of timing", () => {
    const r = shouldRequireBiometric({
      policy: POLICY, lastBiometricUnlockAtSec: 99, actionKind: "approval_decide", nowSec: 100,
    });
    expect(r.required).toBe(true);
    expect(r.reason).toBe("always_required_for_kind");
  });

  it("never unlocked → required", () => {
    const r = shouldRequireBiometric({
      policy: POLICY, lastBiometricUnlockAtSec: null, nowSec: 100,
    });
    expect(r.required).toBe(true);
    expect(r.reason).toBe("never_unlocked");
  });

  it("interval elapsed → required", () => {
    const r = shouldRequireBiometric({
      policy: POLICY, lastBiometricUnlockAtSec: 0, nowSec: 400,
    });
    expect(r.required).toBe(true);
    expect(r.reason).toBe("interval_elapsed");
  });

  it("within interval → not required + countdown", () => {
    const r = shouldRequireBiometric({
      policy: POLICY, lastBiometricUnlockAtSec: 100, nowSec: 200,
    });
    expect(r.required).toBe(false);
    expect(r.secondsUntilNextPrompt).toBe(200);
  });
});

describe("assessSession", () => {
  it("refresh expired → require_login", () => {
    const r = assessSession({
      tokens: TOKENS(50, 50), nowSec: 100,
      policy: POLICY, lastBiometricUnlockAtSec: 100,
    });
    expect(r.verdict).toBe("require_login");
    expect(r.reasons[0]).toContain("refresh token expired");
  });

  it("near-expiry access + recent biometric → warn", () => {
    const r = assessSession({
      tokens: TOKENS(120, 9999), nowSec: 100,
      policy: POLICY, lastBiometricUnlockAtSec: 90,
    });
    expect(r.verdict).toBe("warn");
    expect(r.reasons.some((x) => x.includes("near expiry"))).toBe(true);
  });

  it("biometric never unlocked → warn", () => {
    const r = assessSession({
      tokens: TOKENS(10_000, 99_999), nowSec: 100,
      policy: POLICY, lastBiometricUnlockAtSec: null,
    });
    expect(r.verdict).toBe("warn");
    expect(r.reasons.some((x) => x.includes("biometric never unlocked"))).toBe(true);
  });

  it("everything ok → ok verdict + empty reasons", () => {
    const r = assessSession({
      tokens: TOKENS(10_000, 99_999), nowSec: 100,
      policy: POLICY, lastBiometricUnlockAtSec: 90,
    });
    expect(r.verdict).toBe("ok");
    expect(r.reasons).toEqual([]);
  });
});
