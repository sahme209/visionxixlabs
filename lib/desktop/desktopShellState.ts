/**
 * Canonical desktop shell state.
 *
 * The desktop app and the web's "desktop status" surfaces both depend on
 * the same typed shape. Rather than duplicate fields across views, this
 * module describes the full shell state — connection, version, platform,
 * channel, capability, security mode, handoff queue, audit sync — and a
 * pure aggregator that produces a `DesktopShellSummary` for UI.
 *
 * Tauri's frontend imports these types directly (the Vite frontend and
 * the Next.js app both target the same TS module resolution). The
 * persistence layer is the desktop runtime — this file just owns the
 * shapes everyone reads.
 */

import type { OrganizationId, UserId } from "@/lib/domain/ids";
import type { DataSource } from "@/lib/domain/source";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type DesktopRuntimeState =
  | "boot"                  // App launched, init not finished
  | "ready"                 // Connected, can receive handoffs
  | "offline"               // Disconnected from web
  | "needs_update"          // Tenant min-version exceeded
  | "auth_required"         // Session expired
  | "blocked";              // Trust state revoked / policy blocked

export type DesktopPlatform = "macos" | "windows" | "linux" | "unknown";

export type DesktopChannel = "stable" | "beta" | "preview";

export type DesktopCapability =
  | "review"                // Open handoff bundles, render Terraform/CLI
  | "preview"               // Run `terraform plan` locally
  | "verify"                // Run verification checks
  | "apply"                 // Run `terraform apply` (gated)
  | "execute_cli"           // Execute CLI commands (gated)
  | "audit_sync"            // Upload audit events to the web store
  | "policy_sync"           // Pull tenant policy bundles
  | "keychain";             // Read/write OS keychain credentials

export type DesktopSecurityMode = "strict" | "standard" | "permissive";

export type DesktopConnectionStatus = "online" | "degraded" | "offline" | "unknown";

export type DesktopAuditSyncStatus = "synced" | "pending" | "failing" | "unknown";

// ---------------------------------------------------------------------------
// Shell state
// ---------------------------------------------------------------------------

export interface DesktopShellState {
  /** Tenant + user resolved from the active session, if any. */
  organizationId?: OrganizationId;
  userId?: UserId;

  /** Source tag — desktop runtime always sets "live" once paired. */
  source: DataSource;

  /** High-level lifecycle of the desktop runtime. */
  runtimeState: DesktopRuntimeState;

  /** Local platform info. */
  platform: DesktopPlatform;
  channel: DesktopChannel;
  appVersion: string;
  /** Tenant's required minimum version — when set and the app version is older, runtime state becomes `needs_update`. */
  minRequiredVersion?: string;

  /** Capabilities currently enabled. Audit sync + review are always enabled; apply is opt-in. */
  capabilities: DesktopCapability[];

  /** Security mode chosen by the tenant policy. */
  securityMode: DesktopSecurityMode;

  /** Connection to the web app. */
  connection: DesktopConnectionStatus;
  lastSeenAt?: string;

  /** Audit sync state — desktop must upload before web stories are complete. */
  auditSync: DesktopAuditSyncStatus;
  lastAuditSyncAt?: string;

  /** Number of handoffs in each major lifecycle bucket — for the inbox badge. */
  handoffInbox: {
    eligible: number;
    ready: number;
    inProgress: number;
    awaitingAuditSync: number;
  };

  /** Local execution environment — populated by `LocalEnvironment.report()`. */
  environment: {
    terraformInstalled: boolean;
    awsCliInstalled: boolean;
    azCliInstalled: boolean;
    gcloudInstalled: boolean;
    keychainAvailable: boolean;
  };

  /** True when an update is downloaded and ready to install. */
  updateReady: boolean;

  /** Free-form last error — already redacted by the runtime. */
  lastError?: { code: string; message: string; at: string };
}

// ---------------------------------------------------------------------------
// Defaults — used by the shell on first boot before any signal arrives.
// ---------------------------------------------------------------------------

export const DEFAULT_DESKTOP_SHELL_STATE: DesktopShellState = {
  source: "preview",
  runtimeState: "boot",
  platform: "unknown",
  channel: "preview",
  appVersion: "0.1.0",
  capabilities: ["review", "preview", "verify", "audit_sync"],
  securityMode: "strict",
  connection: "unknown",
  auditSync: "unknown",
  handoffInbox: { eligible: 0, ready: 0, inProgress: 0, awaitingAuditSync: 0 },
  environment: {
    terraformInstalled: false,
    awsCliInstalled: false,
    azCliInstalled: false,
    gcloudInstalled: false,
    keychainAvailable: false,
  },
  updateReady: false,
};

// ---------------------------------------------------------------------------
// Summary — pure aggregator used by both desktop shell and web Command Center
// ---------------------------------------------------------------------------

export type ShellSemantic = "neutral" | "success" | "warning" | "error";

export interface ShellCheck {
  id: string;
  label: string;
  detail: string;
  semantic: ShellSemantic;
}

export interface DesktopShellSummary {
  state: DesktopShellState;
  overall: ShellSemantic;
  /** Short top-line ("Ready · macOS · v0.1.0"). */
  headline: string;
  checks: ShellCheck[];
}

export function summarizeShell(state: DesktopShellState): DesktopShellSummary {
  const checks: ShellCheck[] = [];

  // Runtime state
  checks.push({
    id: "runtime",
    label: "Runtime",
    detail:
      state.runtimeState === "ready"          ? "Desktop is connected and accepting handoffs." :
      state.runtimeState === "boot"           ? "Desktop is initialising." :
      state.runtimeState === "offline"        ? "Desktop is not currently connected to the web app." :
      state.runtimeState === "needs_update"   ? `Update required — minimum version is ${state.minRequiredVersion ?? "unknown"}.` :
      state.runtimeState === "auth_required"  ? "Session expired — sign in again on the desktop app." :
                                                "Desktop is blocked by tenant policy or trust state.",
    semantic:
      state.runtimeState === "ready"        ? "success" :
      state.runtimeState === "boot"         ? "neutral" :
      state.runtimeState === "needs_update" ? "warning" :
                                              "error",
  });

  // Connection
  checks.push({
    id: "connection",
    label: "Connection",
    detail:
      state.connection === "online"   ? `Last seen ${state.lastSeenAt ? formatRelative(state.lastSeenAt) : "just now"}.` :
      state.connection === "degraded" ? "Connection unstable — retrying." :
      state.connection === "offline"  ? "Offline — handoffs will queue until reconnected." :
                                        "No recent observation.",
    semantic:
      state.connection === "online"   ? "success" :
      state.connection === "degraded" ? "warning" :
      state.connection === "offline"  ? "warning" :
                                        "neutral",
  });

  // Audit sync
  checks.push({
    id: "audit_sync",
    label: "Audit sync",
    detail:
      state.auditSync === "synced"  ? "All desktop events have reached the web audit store." :
      state.auditSync === "pending" ? "Audit events queued locally — will sync when online." :
      state.auditSync === "failing" ? "Audit sync is failing — see desktop logs." :
                                       "No recent sync.",
    semantic:
      state.auditSync === "synced"  ? "success" :
      state.auditSync === "pending" ? "warning" :
      state.auditSync === "failing" ? "error" :
                                       "neutral",
  });

  // Capabilities
  const hasApply = state.capabilities.includes("apply");
  checks.push({
    id: "capabilities",
    label: "Capabilities",
    detail: hasApply
      ? "Desktop apply is enabled (approval-gated)."
      : "Desktop apply is disabled — review-only mode.",
    semantic: hasApply ? "warning" : "success",
  });

  // Environment hints
  const env = state.environment;
  const envCount = (env.terraformInstalled ? 1 : 0) + (env.awsCliInstalled ? 1 : 0) + (env.azCliInstalled ? 1 : 0) + (env.gcloudInstalled ? 1 : 0);
  checks.push({
    id: "environment",
    label: "Local environment",
    detail: `${envCount} of 4 CLI integrations detected${env.keychainAvailable ? " · keychain available" : ""}.`,
    semantic: envCount === 0 ? "neutral" : envCount >= 2 ? "success" : "warning",
  });

  // Handoff inbox
  const inbox = state.handoffInbox;
  const totalInbox = inbox.eligible + inbox.ready + inbox.inProgress + inbox.awaitingAuditSync;
  checks.push({
    id: "handoff_inbox",
    label: "Handoff inbox",
    detail: totalInbox === 0
      ? "No pending handoffs."
      : `${inbox.ready} ready · ${inbox.inProgress} in progress · ${inbox.awaitingAuditSync} awaiting audit sync.`,
    semantic: inbox.awaitingAuditSync > 0 ? "warning" : inbox.ready > 0 ? "success" : "neutral",
  });

  // Overall = worst
  const order: ShellSemantic[] = ["error", "warning", "neutral", "success"];
  let overall: ShellSemantic = "success";
  for (const tone of order) {
    if (checks.some((c) => c.semantic === tone)) { overall = tone; break; }
  }

  const headline = `${state.runtimeState === "ready" ? "Ready" : state.runtimeState === "boot" ? "Initialising" : state.runtimeState === "needs_update" ? "Update required" : state.runtimeState === "offline" ? "Offline" : state.runtimeState === "auth_required" ? "Sign-in required" : "Blocked"} · ${labelPlatform(state.platform)} · v${state.appVersion}`;

  return { state, overall, headline, checks };
}

function labelPlatform(p: DesktopPlatform): string {
  switch (p) {
    case "macos":   return "macOS";
    case "windows": return "Windows";
    case "linux":   return "Linux";
    case "unknown": return "Unknown";
  }
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 60 * 60_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.round(diff / (60 * 60_000))}h ago`;
  return `${Math.round(diff / (24 * 60 * 60_000))}d ago`;
}
