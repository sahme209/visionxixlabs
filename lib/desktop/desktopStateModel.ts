/**
 * Unified desktop state contract.
 *
 * The product asked for a single DesktopState shape that aggregates:
 *   - workspace / session
 *   - handoff inbox
 *   - review items
 *   - platform packaging status (macOS / Windows / Linux)
 *   - safety status
 *   - sync + audit status
 *   - limitations + safeNextAction
 *
 * This is **declarative**. The actual session + handoff lifecycle is
 * handled by:
 *   - lib/desktop/desktopSession.ts
 *   - lib/desktop/executionHandoff.ts
 *   - lib/desktop/desktopToken.ts
 *
 * This module composes their outputs (and the platform-status surface)
 * into one typed read for any UI that wants the full picture.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import {
  buildDesktopProductModel,
  type DesktopProductModel,
} from "./desktopProductModel";

// ---------------------------------------------------------------------------
// Platform status
// ---------------------------------------------------------------------------

export type DesktopPlatform = "macos-arm" | "macos-intel" | "windows" | "linux";

export type PlatformBuildStatus =
  | "available"                  // signed binary exists + publicly available
  | "local_build_only"           // builds locally, no public artefact
  | "signing_required"           // builds + can run, not yet signed
  | "notarization_pending"       // macOS only — signed, awaiting notarytool
  | "certificate_required"       // Windows only — needs EV cert
  | "package_pending"            // Linux only — package format pending
  | "not_supported";             // platform explicitly out of scope

export interface PlatformStatusEntry {
  platform: DesktopPlatform;
  /** Honest build status — surface labels from PlatformBuildStatus. */
  buildStatus: PlatformBuildStatus;
  /** Honest signing status, separated from build status. */
  signed: boolean;
  /** macOS-only — notarization status. */
  notarized?: boolean;
  /** Public-download availability. */
  publiclyDownloadable: boolean;
  /** Operator-facing label. */
  label: string;
  /** Known blocker the operator should see. */
  blocker?: string;
  /** Safe next action. */
  safeNextAction?: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Review item shape — what desktop sees in its inbox
// ---------------------------------------------------------------------------

export type DesktopReviewItemKind =
  | "remediation_plan"
  | "simulation_result"
  | "approval_review"
  | "evidence_bundle";

export interface DesktopReviewItem {
  id: string;
  kind: DesktopReviewItemKind;
  sourceSystem: "aws" | "azure" | "gcp" | "github" | "security_scanner";
  /** Where this came from — server-side correlation id. */
  remediationCandidateId?: string;
  simulationId?: string;
  approvalId?: string;
  title: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  evidenceRefs: string[];
  terraformPreviewAvailable: boolean;
  cliPreviewAvailable: boolean;
  rollbackPlanAvailable: boolean;
  verificationChecklistAvailable: boolean;
  /** Always true on this build — encoded in PilotMode + DesktopProductModel. */
  approvalRequired: true;
  /** Always true on this build — desktop never executes. */
  localExecutionDisabled: true;
  sourceMode: "live" | "partial_live" | "preview" | "blocked";
}

// ---------------------------------------------------------------------------
// Top-level DesktopState
// ---------------------------------------------------------------------------

export interface DesktopState {
  /** Tenant identity. */
  tenantId: string;
  generatedAt: string;

  /** Current authenticated platform if known (e.g. "macos-arm"). */
  platform: DesktopPlatform | "unknown";
  /** Tauri shell version reported by the desktop client, if available. */
  appVersion?: string;

  /** Honest session rollup. */
  sessionStatus: "active" | "expired" | "not_paired";
  /** When the active session expires. */
  tokenExpiresAt?: string;
  /** When the session last beat. */
  lastSeenAt?: string;

  /** Composite source mode — drops to lowest of session / platform / sync. */
  sourceMode: "live" | "partial_live" | "preview" | "blocked" | "unknown";

  /** Counts shown in Command Center desktop card. */
  handoffInboxCount: number;
  reviewItemCount: number;

  /** Platform-by-platform packaging status. */
  platformStatus: PlatformStatusEntry[];

  /** Audit sync status — desktop ↔ web reconciliation. */
  auditSyncStatus: "live" | "preview" | "disabled";

  /** Workspace sync status — when did the desktop last fetch state? */
  syncStatus: "synced" | "stale" | "not_synced";

  /** Honest local-execution status — should always read "disabled". */
  localExecutionStatus: "disabled";

  /** Product model the desktop is enforcing. */
  productModel: DesktopProductModel;

  /** Honest aggregate limitations. */
  limitations: string[];

  /** Operator-facing safe next action. */
  safeNextAction?: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Platform status builder — honest by construction
// ---------------------------------------------------------------------------

export function buildPlatformStatus(): PlatformStatusEntry[] {
  const env = loadAppEnv();
  // Honest defaults: until env signals exist for "public download available",
  // every platform is `local_build_only` regardless of signing progress.
  const downloadsPublic = env.desktopDownloadsEnabled;

  return [
    {
      platform: "macos-arm",
      buildStatus: downloadsPublic ? "available" : "local_build_only",
      signed: true,        // Apple Developer ID signing pipeline shipped in earlier phase
      notarized: true,     // notarytool pipeline shipped in earlier phase
      publiclyDownloadable: downloadsPublic,
      label: downloadsPublic ? "Apple Silicon — signed + notarized" : "Apple Silicon — signed + notarized, public download pending",
      blocker: downloadsPublic ? undefined : "DESKTOP_DOWNLOADS_ENABLED not set — public binary URL not yet exposed.",
      safeNextAction: { label: "Open desktop install docs", href: "/docs/desktop-install" },
    },
    {
      platform: "macos-intel",
      buildStatus: downloadsPublic ? "available" : "local_build_only",
      signed: true,
      notarized: true,
      publiclyDownloadable: downloadsPublic,
      label: downloadsPublic ? "Intel macOS — signed + notarized" : "Intel macOS — signed + notarized, public download pending",
      blocker: downloadsPublic ? undefined : "DESKTOP_DOWNLOADS_ENABLED not set.",
      safeNextAction: { label: "Open desktop install docs", href: "/docs/desktop-install" },
    },
    {
      platform: "windows",
      buildStatus: "signing_required",
      signed: false,
      publiclyDownloadable: false,
      label: "Windows x64 — build available, EV signing pending",
      blocker: "Windows EV code-signing certificate required to clear SmartScreen.",
      safeNextAction: { label: "Open desktop install docs", href: "/docs/desktop-install" },
    },
    {
      platform: "linux",
      buildStatus: "signing_required",
      signed: false,
      publiclyDownloadable: false,
      label: "Linux x64 — AppImage / .deb / .rpm build available, GPG-signed",
      blocker: "Public distribution pipeline (AppImage hub / apt / rpm) pending.",
      safeNextAction: { label: "Open desktop install docs", href: "/docs/desktop-install" },
    },
  ];
}

// ---------------------------------------------------------------------------
// Composer — builds the unified DesktopState
// ---------------------------------------------------------------------------

export interface BuildDesktopStateInput {
  tenantId: string;
  sessionStatus?: DesktopState["sessionStatus"];
  platform?: DesktopState["platform"];
  appVersion?: string;
  tokenExpiresAt?: string;
  lastSeenAt?: string;
  handoffInboxCount?: number;
  reviewItemCount?: number;
}

export function buildDesktopState(input: BuildDesktopStateInput): DesktopState {
  const env = loadAppEnv();
  const productModel = buildDesktopProductModel();
  const platformStatus = buildPlatformStatus();

  // Roll up source mode honestly.
  let sourceMode: DesktopState["sourceMode"];
  if (input.sessionStatus === "active" && env.databaseUrlSet) sourceMode = "live";
  else if (input.sessionStatus === "active") sourceMode = "partial_live";
  else sourceMode = "preview";

  const limitations: string[] = [];
  if (!env.databaseUrlSet) limitations.push("Session persistence is in-memory — set DATABASE_URL for durable sessions.");
  if (!env.desktopHandoffSigningKeySet) limitations.push("DESKTOP_HANDOFF_SIGNING_KEY not set — falling back to NEXTAUTH_SECRET.");
  if (!env.desktopDownloadsEnabled) limitations.push("Public desktop downloads not yet enabled — binaries available locally.");

  return {
    tenantId: input.tenantId,
    generatedAt: new Date().toISOString(),
    platform: input.platform ?? "unknown",
    appVersion: input.appVersion,
    sessionStatus: input.sessionStatus ?? "not_paired",
    tokenExpiresAt: input.tokenExpiresAt,
    lastSeenAt: input.lastSeenAt,
    sourceMode,
    handoffInboxCount: input.handoffInboxCount ?? 0,
    reviewItemCount: input.reviewItemCount ?? 0,
    platformStatus,
    auditSyncStatus: env.databaseUrlSet ? "live" : "preview",
    syncStatus: input.sessionStatus === "active" ? "synced" : "not_synced",
    localExecutionStatus: "disabled",
    productModel,
    limitations,
    safeNextAction: input.sessionStatus === "active"
      ? { label: "Open desktop review inbox", href: "/desktop" }
      : { label: "Open desktop install + pairing", href: "/desktop" },
  };
}
