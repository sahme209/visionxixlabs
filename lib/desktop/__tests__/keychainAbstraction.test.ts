/**
 * Vitest unit tests for the pure keychain abstraction.
 */

import { describe, it, expect } from "vitest";
import { assessKeychainHealth, describeKeychainTarget } from "../keychainAbstraction";

describe("describeKeychainTarget", () => {
  it("macos → macos_keychain backend", () => {
    const t = describeKeychainTarget({ os: "macos", tenantId: "tenant-1", secret: "access_token" });
    expect(t.backend).toBe("macos_keychain");
  });

  it("windows → win_credential_manager backend", () => {
    const t = describeKeychainTarget({ os: "windows", tenantId: "tenant-1", secret: "refresh_token" });
    expect(t.backend).toBe("win_credential_manager");
  });

  it("linux → linux_secret_service backend", () => {
    const t = describeKeychainTarget({ os: "linux", tenantId: "tenant-1", secret: "outlook_graph_token" });
    expect(t.backend).toBe("linux_secret_service");
  });

  it("unknown → in_memory_fallback", () => {
    const t = describeKeychainTarget({ os: "unknown", tenantId: "tenant-1", secret: "access_token" });
    expect(t.backend).toBe("in_memory_fallback");
  });

  it("service name is namespaced per tenant", () => {
    const t = describeKeychainTarget({ os: "macos", tenantId: "tenant-42", secret: "access_token" });
    expect(t.service).toBe("axiom.visionxixlabs.tenant-42");
  });

  it("account name matches the secret slot", () => {
    const t = describeKeychainTarget({ os: "macos", tenantId: "t", secret: "slack_bot_token" });
    expect(t.account).toBe("slack_bot_token");
  });

  it("all secrets default to syncable=false", () => {
    const t = describeKeychainTarget({ os: "macos", tenantId: "t", secret: "biometric_unlock_seed" });
    expect(t.syncable).toBe(false);
  });
});

describe("assessKeychainHealth", () => {
  it("probe ok + fast → operational", () => {
    const h = assessKeychainHealth({ probeRoundTripOk: true, probeLatencyMs: 100 });
    expect(h.ok).toBe(true);
    expect(h.verdict).toBe("operational");
  });

  it("probe ok + slow (>1500ms) → degraded", () => {
    const h = assessKeychainHealth({ probeRoundTripOk: true, probeLatencyMs: 2_000 });
    expect(h.verdict).toBe("degraded");
  });

  it("probe failed → down with errorKind in detail", () => {
    const h = assessKeychainHealth({ probeRoundTripOk: false, lastErrorKind: "kSecAuthFailed" });
    expect(h.ok).toBe(false);
    expect(h.verdict).toBe("down");
    expect(h.detail).toContain("kSecAuthFailed");
  });
});
