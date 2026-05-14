/**
 * Supply-chain security posture — typed contracts the Security Center reads.
 *
 * This module does *not* fake controls Axiom hasn't implemented yet. It
 * captures the current state honestly so reviewers can see (a) what's
 * actually in place and (b) what's on the roadmap. Surfaces consuming this
 * module render an honest checklist rather than a green wall.
 */

import type { DataSource } from "@/lib/domain/source";

// ---------------------------------------------------------------------------
// Control taxonomy
// ---------------------------------------------------------------------------

export type SupplyChainControlId =
  | "dependency.lockfile_integrity"
  | "dependency.vulnerability_scan"
  | "dependency.license_scan"
  | "build.reproducibility"
  | "build.provenance_attestation"
  | "ci.secret_scanning"
  | "ci.required_reviews"
  | "ci.environment_protection"
  | "release.artifact_signing"
  | "release.sbom_published"
  | "desktop.binary_signing"
  | "desktop.update_channel_signing"
  | "runtime.secret_redaction"
  | "runtime.env_var_hygiene";

export type ControlStatus =
  | "implemented"   // Verified in the current build
  | "in_progress"   // Wired up partially
  | "planned"       // Acknowledged, not yet started
  | "n/a";          // Not applicable to this deployment

export interface SupplyChainControl {
  id: SupplyChainControlId;
  label: string;
  description: string;
  status: ControlStatus;
  /** Last time this status was attested by an operator or CI signal. */
  lastAttestedAt?: string;
  /** Honest source of the status. */
  source: DataSource;
}

// ---------------------------------------------------------------------------
// Canonical baseline
// ---------------------------------------------------------------------------

/**
 * Current honest baseline. The values here match the actual state of the
 * platform — do not flip these to "implemented" without a corresponding
 * code change and (where relevant) a CI signal.
 */
export const SUPPLY_CHAIN_BASELINE: SupplyChainControl[] = [
  {
    id: "dependency.lockfile_integrity",
    label: "Lockfile integrity",
    description: "package-lock.json is committed and verified by CI on every install.",
    status: "implemented",
    source: "live",
  },
  {
    id: "dependency.vulnerability_scan",
    label: "Dependency vulnerability scan",
    description: "Continuous scan against published CVEs for npm dependencies.",
    status: "in_progress",
    source: "preview",
  },
  {
    id: "dependency.license_scan",
    label: "License scan",
    description: "Flag transitive packages with non-permissive licences.",
    status: "planned",
    source: "preview",
  },
  {
    id: "build.reproducibility",
    label: "Reproducible builds",
    description: "Two runs of the same commit produce byte-identical bundles.",
    status: "planned",
    source: "preview",
  },
  {
    id: "build.provenance_attestation",
    label: "Build provenance attestation",
    description: "SLSA provenance metadata attached to every published artifact.",
    status: "planned",
    source: "preview",
  },
  {
    id: "ci.secret_scanning",
    label: "Secret scanning",
    description: "Pre-commit and CI scans block accidental secret commits.",
    status: "in_progress",
    source: "preview",
  },
  {
    id: "ci.required_reviews",
    label: "Required code review",
    description: "Protected default branch requires at least one approving review.",
    status: "implemented",
    source: "live",
  },
  {
    id: "ci.environment_protection",
    label: "Environment protection rules",
    description: "Production deploys require manual approval through GitHub environments.",
    status: "in_progress",
    source: "preview",
  },
  {
    id: "release.artifact_signing",
    label: "Release artifact signing",
    description: "Web release bundles signed and verified at deploy time.",
    status: "planned",
    source: "preview",
  },
  {
    id: "release.sbom_published",
    label: "SBOM published per release",
    description: "CycloneDX SBOM generated and published alongside each release.",
    status: "planned",
    source: "preview",
  },
  {
    id: "desktop.binary_signing",
    label: "Desktop binary signing",
    description: "Desktop binaries signed (macOS notarized, Windows EV signed).",
    status: "planned",
    source: "preview",
  },
  {
    id: "desktop.update_channel_signing",
    label: "Desktop update channel signing",
    description: "Update manifests signed; client refuses unsigned updates.",
    status: "planned",
    source: "preview",
  },
  {
    id: "runtime.secret_redaction",
    label: "Secret redaction in runtime outputs",
    description: "All logs, errors, audit events, and AI contexts run through redaction.",
    status: "implemented",
    source: "live",
  },
  {
    id: "runtime.env_var_hygiene",
    label: "Environment variable hygiene",
    description: "Required secrets are validated at boot; missing values fail closed.",
    status: "in_progress",
    source: "live",
  },
];

// ---------------------------------------------------------------------------
// Summary helpers
// ---------------------------------------------------------------------------

export interface SupplyChainSummary {
  implemented: number;
  inProgress: number;
  planned: number;
  notApplicable: number;
  total: number;
  /** Score from 0..1 weighted by implemented + half-weight in_progress. */
  score: number;
}

export function summarizeSupplyChain(controls: SupplyChainControl[] = SUPPLY_CHAIN_BASELINE): SupplyChainSummary {
  let implemented = 0;
  let inProgress = 0;
  let planned = 0;
  let notApplicable = 0;
  for (const c of controls) {
    if (c.status === "implemented") implemented++;
    else if (c.status === "in_progress") inProgress++;
    else if (c.status === "planned") planned++;
    else notApplicable++;
  }
  const denom = controls.length - notApplicable || 1;
  const score = Math.min(1, Math.max(0, (implemented + inProgress * 0.5) / denom));
  return { implemented, inProgress, planned, notApplicable, total: controls.length, score };
}
