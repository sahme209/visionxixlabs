/**
 * Security posture aggregator — pure function over the canonical security
 * modules. Used by the Security Center UI and the Command Center's security
 * tile so they render identical posture math.
 */

import { redactionCoverage } from "./redaction";
import { rbacSnapshot } from "./rbac";
import type { RbacSnapshot } from "./rbac";
import { SUPPLY_CHAIN_BASELINE, summarizeSupplyChain } from "./supplyChain";
import type { SupplyChainControl, SupplyChainSummary } from "./supplyChain";
import type { CredentialMetadata } from "./credentialMeta";
import { deriveRotationState } from "./credentialMeta";
import type { PairedDesktop, DesktopTrustProfile } from "@/lib/desktop/desktopSecurity";
import type { DataSource } from "@/lib/domain/source";

// ---------------------------------------------------------------------------
// Posture inputs
// ---------------------------------------------------------------------------

export interface SecurityPostureInputs {
  source: DataSource;
  credentials: CredentialMetadata[];
  pairedDesktops: PairedDesktop[];
  desktopProfile?: DesktopTrustProfile;
  /** Number of cross-tenant attempts recorded in the last 30 days. */
  crossTenantAttempts30d: number;
  /** Number of policy-blocked actions in the last 30 days. */
  policyBlocks30d: number;
  /** Number of high-risk findings currently outstanding. */
  openHighRiskFindings: number;
  /** Whether secret redaction is active in this build. */
  redactionEnabled: boolean;
  /** Whether the secure audit store is configured. */
  auditStoreConfigured: boolean;
  /** Whether AI/copilot context safety is active. */
  copilotContextSafe: boolean;
}

// ---------------------------------------------------------------------------
// Posture output
// ---------------------------------------------------------------------------

export type PostureSemantic = "neutral" | "success" | "warning" | "error";

export interface PostureCheck {
  id: string;
  label: string;
  detail: string;
  semantic: PostureSemantic;
}

export interface SecurityPosture {
  source: DataSource;
  score: number;            // 0..1
  semantic: PostureSemantic;
  checks: PostureCheck[];
  rbac: RbacSnapshot;
  redaction: ReturnType<typeof redactionCoverage>;
  supplyChain: { controls: SupplyChainControl[]; summary: SupplyChainSummary };
  credentialSummary: CredentialPostureSummary;
  desktopSummary: DesktopPostureSummary;
}

export interface CredentialPostureSummary {
  total: number;
  delegated: number;
  rotationDue: number;
  rotationOverdue: number;
  revoked: number;
  compromised: number;
}

export interface DesktopPostureSummary {
  paired: number;
  trusted: number;
  blocked: number;
}

// ---------------------------------------------------------------------------
// Aggregator
// ---------------------------------------------------------------------------

export function buildSecurityPosture(input: SecurityPostureInputs): SecurityPosture {
  const checks: PostureCheck[] = [];

  // --- Tenant isolation
  checks.push({
    id: "tenant.isolation",
    label: "Tenant isolation",
    detail: input.crossTenantAttempts30d > 0
      ? `${input.crossTenantAttempts30d} cross-tenant attempt(s) blocked in the last 30 days.`
      : "No cross-tenant attempts detected in the last 30 days.",
    semantic: input.crossTenantAttempts30d > 10 ? "warning" : "success",
  });

  // --- Redaction
  checks.push({
    id: "redaction.active",
    label: "Secret redaction",
    detail: input.redactionEnabled
      ? `${redactionCoverage().patterns.length} patterns active across logs, events, and AI context.`
      : "Secret redaction is not active in this build.",
    semantic: input.redactionEnabled ? "success" : "error",
  });

  // --- Audit
  checks.push({
    id: "audit.store",
    label: "Secure audit log",
    detail: input.auditStoreConfigured
      ? "Audit store is configured. Sensitive actions are recorded."
      : "Audit store is not configured — sensitive actions are not being persisted.",
    semantic: input.auditStoreConfigured ? "success" : "error",
  });

  // --- AI context safety
  checks.push({
    id: "copilot.context",
    label: "AI / copilot context safety",
    detail: input.copilotContextSafe
      ? "Copilot context goes through redaction + guardrails before any LLM call."
      : "Copilot context safety is not active.",
    semantic: input.copilotContextSafe ? "success" : "error",
  });

  // --- Policy enforcement
  checks.push({
    id: "policy.enforcement",
    label: "Policy enforcement",
    detail: input.policyBlocks30d > 0
      ? `${input.policyBlocks30d} action(s) blocked by policy in the last 30 days.`
      : "No policy-blocked actions in the last 30 days.",
    semantic: "success",
  });

  // --- Credentials
  const credSummary = summarizeCredentials(input.credentials);
  checks.push({
    id: "credentials.rotation",
    label: "Credential rotation",
    detail: credSummary.rotationOverdue > 0
      ? `${credSummary.rotationOverdue} credential(s) past rotation deadline.`
      : credSummary.rotationDue > 0
        ? `${credSummary.rotationDue} credential(s) approaching rotation.`
        : "All credentials within rotation policy.",
    semantic: credSummary.rotationOverdue > 0 ? "error" : credSummary.rotationDue > 0 ? "warning" : "success",
  });
  checks.push({
    id: "credentials.delegated",
    label: "Delegated access preferred",
    detail: credSummary.total === 0
      ? "No credentials registered yet."
      : `${credSummary.delegated} of ${credSummary.total} credential(s) use delegated trust (IAM Role, Workload Identity, GitHub App).`,
    semantic: credSummary.total === 0 || credSummary.delegated / credSummary.total >= 0.5 ? "success" : "warning",
  });

  // --- Desktop
  const dsk = summarizeDesktops(input.pairedDesktops);
  checks.push({
    id: "desktop.trust",
    label: "Desktop trust",
    detail: dsk.paired === 0
      ? "No desktop runtimes paired."
      : `${dsk.trusted} of ${dsk.paired} paired desktop(s) trusted; ${dsk.blocked} blocked.`,
    semantic: dsk.paired === 0 ? "neutral" : dsk.blocked > 0 ? "warning" : "success",
  });

  // --- Findings
  checks.push({
    id: "findings.high_risk",
    label: "Open high-risk findings",
    detail: input.openHighRiskFindings > 0
      ? `${input.openHighRiskFindings} high-risk finding(s) outstanding.`
      : "No open high-risk findings.",
    semantic: input.openHighRiskFindings > 5 ? "error" : input.openHighRiskFindings > 0 ? "warning" : "success",
  });

  // --- Score: weight each semantic
  const weight: Record<PostureSemantic, number> = { success: 1, neutral: 0.7, warning: 0.4, error: 0 };
  const score = checks.length === 0 ? 1 : checks.reduce((s, c) => s + weight[c.semantic], 0) / checks.length;
  const semantic: PostureSemantic = score >= 0.9 ? "success" : score >= 0.6 ? "warning" : "error";

  return {
    source: input.source,
    score,
    semantic,
    checks,
    rbac: rbacSnapshot(),
    redaction: redactionCoverage(),
    supplyChain: { controls: SUPPLY_CHAIN_BASELINE, summary: summarizeSupplyChain() },
    credentialSummary: credSummary,
    desktopSummary: dsk,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function summarizeCredentials(creds: CredentialMetadata[]): CredentialPostureSummary {
  let delegated = 0;
  let rotationDue = 0;
  let rotationOverdue = 0;
  let revoked = 0;
  let compromised = 0;
  for (const c of creds) {
    const derived = deriveRotationState(c);
    if (derived.state === "rotation_due") rotationDue++;
    if (derived.state === "rotation_overdue") rotationOverdue++;
    if (c.state === "revoked") revoked++;
    if (c.state === "compromised") compromised++;
    if (isDelegatedMaterial(c.material)) delegated++;
  }
  return { total: creds.length, delegated, rotationDue, rotationOverdue, revoked, compromised };
}

function isDelegatedMaterial(material: CredentialMetadata["material"]): boolean {
  return (
    material === "aws_role_arn" ||
    material === "azure_managed_identity" ||
    material === "gcp_workload_identity" ||
    material === "github_app_installation" ||
    material === "slack_oauth" ||
    material === "servicenow_oauth"
  );
}

function summarizeDesktops(desktops: PairedDesktop[]): DesktopPostureSummary {
  let trusted = 0;
  let blocked = 0;
  for (const d of desktops) {
    if (d.state === "trusted") trusted++;
    if (d.state === "version_blocked" || d.state === "signature_blocked" || d.state === "policy_blocked" || d.state === "revoked") blocked++;
  }
  return { paired: desktops.length, trusted, blocked };
}
