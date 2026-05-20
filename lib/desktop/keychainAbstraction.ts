/**
 * Pure cross-platform keychain abstraction.
 *
 * Computes the per-OS keychain backend reference + the canonical
 * service / account names. The desktop shell wires an actual backend
 * (keytar on Electron, Stronghold on Tauri, native Swift Keychain
 * SDK on a native macOS app) and asks this module which one to use +
 * what to call the entry.
 *
 * Pure / deterministic. NEVER reads/writes secrets — that's the
 * shell's job; we only describe where they should live.
 */

import type { DesktopOs } from "./platformCapabilities";

export type KeychainBackend = "macos_keychain" | "win_credential_manager" | "linux_secret_service" | "in_memory_fallback";

export interface KeychainTargetInput {
  os: DesktopOs;
  /** Tenant id so multi-tenant installs don't collide. */
  tenantId: string;
  /** Closed-union secret kind so callers can't invent names. */
  secret:
    | "access_token"
    | "refresh_token"
    | "outlook_graph_token"
    | "slack_bot_token"
    | "teams_graph_token"
    | "biometric_unlock_seed";
}

export interface KeychainTarget {
  backend: KeychainBackend;
  /** Service name (Windows "target name" / macOS "service" / libsecret "label"). */
  service: string;
  /** Account name (Windows "user" / macOS "account" / libsecret "account"). */
  account: string;
  /** Whether the entry is OK to roam (iCloud Keychain sync etc.). */
  syncable: boolean;
}

const BACKEND_FOR_OS: Record<DesktopOs, KeychainBackend> = {
  macos:   "macos_keychain",
  windows: "win_credential_manager",
  linux:   "linux_secret_service",
  unknown: "in_memory_fallback",
};

const SYNCABLE_SECRETS = new Set<KeychainTargetInput["secret"]>([
  // Refresh / biometric seeds are tenant-bound and shouldn't roam.
  // Access tokens are too short-lived to bother syncing.
]);

export function describeKeychainTarget(input: KeychainTargetInput): KeychainTarget {
  const backend = BACKEND_FOR_OS[input.os];
  return {
    backend,
    service: `axiom.visionxixlabs.${input.tenantId}`,
    account: input.secret,
    syncable: SYNCABLE_SECRETS.has(input.secret),
  };
}

export interface KeychainHealthInput {
  /** True if the shell successfully wrote+read a probe value at startup. */
  probeRoundTripOk: boolean;
  /** Last error code surfaced by the backend (operator-readable). */
  lastErrorKind?: string;
  /** Backend latency on the probe (ms). */
  probeLatencyMs?: number;
}

export interface KeychainHealth {
  ok: boolean;
  detail: string;
  /** Verdict ladder. */
  verdict: "operational" | "degraded" | "down";
}

export function assessKeychainHealth(input: KeychainHealthInput): KeychainHealth {
  if (!input.probeRoundTripOk) {
    return {
      ok: false,
      verdict: "down",
      detail: `keychain probe failed${input.lastErrorKind ? ` (${input.lastErrorKind})` : ""}`,
    };
  }
  if ((input.probeLatencyMs ?? 0) > 1500) {
    return { ok: true, verdict: "degraded", detail: `slow probe (${input.probeLatencyMs}ms)` };
  }
  return { ok: true, verdict: "operational", detail: "probe round-trip ok" };
}
