/**
 * Desktop Release Management Center — typed contract.
 *
 * Single canonical model for the operator's release control surface.
 * Joins three already-canonical sources:
 *
 *   - `getDesktopReleaseManifest()` (live GitHub release lookup)
 *   - `buildDistributionTable()`    (versionModel-derived gate checklist)
 *   - `RELEASE_REGISTRY`            (per-artefact signing / notarization)
 *
 * Every gate is honest: when a signing cert / notarization step is
 * missing, the entry shows the gap rather than a fake "shipped" pill.
 * The center never *publishes* — that happens in CI from a tagged
 * commit. The platform contract is `release_review_only_no_publish`.
 */

import type { DesktopPlatform } from "./releaseManifest";

export type DesktopReleaseSourceMode =
  | "live"
  | "partial_live"
  | "preview"
  | "foundation"
  | "planned"
  | "blocked"
  | "disabled"
  | "unknown";

export type DesktopReleaseGateStatus =
  | "passing"
  | "partial"
  | "preview"
  | "blocked"
  | "planned";

export type DesktopReleaseGateId =
  | "binary_built"
  | "code_signed"
  | "notarized"
  | "distribution_published"
  | "auto_update_channel"
  | "signing_key_configured"
  | "min_version_enforced"
  | "rollback_plan"
  | "release_notes_published";

export type DesktopReleaseChannel = "stable" | "beta" | "preview" | "dev" | "enterprise";

export interface DesktopReleaseGate {
  id: DesktopReleaseGateId;
  label: string;
  description: string;
  status: DesktopReleaseGateStatus;
  /** Why the gate is in this state — operator-readable. */
  reason: string;
  /** Evidence ref / file path / env name. */
  evidenceRef: string;
  /** Optional one-line next fix. */
  nextFix?: string;
}

export interface DesktopReleasePlatformEntry {
  platform: DesktopPlatform;
  label: string;
  /** Honest distribution state. */
  state: "live" | "preview" | "planned" | "blocked" | "deprecated";
  /** Most recent published version for this platform — `undefined` until a GH release attaches an asset. */
  liveVersion?: string;
  /** Channel currently active for this platform. */
  channel: DesktopReleaseChannel;
  /** Asset filename when published. */
  assetFileName?: string;
  /** Download URL when published. */
  downloadUrl?: string;
  /** Size in bytes when published. */
  sizeBytes?: number;
  /** Signed / notarized booleans — never inferred, only the CI markers. */
  signed: boolean;
  notarized: boolean;
  /** One-line install friction the operator should expect. */
  installFriction: string;
  /** Per-platform gates derived from the registry + manifest. */
  gates: DesktopReleaseGate[];
}

export interface DesktopReleaseSummary {
  totalPlatforms: number;
  liveCount: number;
  previewCount: number;
  plannedCount: number;
  blockedCount: number;
  signedCount: number;
  notarizedCount: number;
  /** True when every published platform is signed + notarized. */
  allSignedAndNotarized: boolean;
  /** Active release tag (e.g. "desktop-v0.1.0") when available. */
  latestTag?: string;
  /** Release publish time when available. */
  latestPublishedAt?: string;
  /** Public release page URL when available. */
  latestHtmlUrl?: string;
}

export interface DesktopReleaseReport {
  generatedAt: string;
  tenantId?: string;
  /** Overall sourceMode — `live` when the manifest fetch returned a real release, otherwise `preview`. */
  sourceMode: DesktopReleaseSourceMode;
  /** Platform-by-platform release state. */
  platforms: DesktopReleasePlatformEntry[];
  /** Cross-platform gates (signing key, rollout, channel, etc). */
  globalGates: DesktopReleaseGate[];
  summary: DesktopReleaseSummary;
  /** Hard-literal safety contract. */
  safetyContract: "release_review_only_no_publish";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

export const GATE_STATUS_LABEL: Record<DesktopReleaseGateStatus, string> = {
  passing: "Passing",
  partial: "Partial",
  preview: "Preview",
  blocked: "Blocked",
  planned: "Planned",
};

export const GATE_STATUS_TONE: Record<DesktopReleaseGateStatus, "emerald" | "cyan" | "amber" | "rose" | "zinc"> = {
  passing: "emerald",
  partial: "cyan",
  preview: "amber",
  blocked: "rose",
  planned: "zinc",
};

export const PLATFORM_LABEL: Record<DesktopPlatform, string> = {
  "macos-arm":   "macOS · Apple Silicon",
  "macos-intel": "macOS · Intel",
  "windows-x64": "Windows · x64",
  "linux-x64":   "Linux · x64",
};
