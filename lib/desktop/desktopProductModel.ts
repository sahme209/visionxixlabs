/**
 * Desktop product model — typed contract for "what the desktop app IS
 * and ISN'T allowed to do."
 *
 * The actual runtime enforcement lives in:
 *  - lib/operatingLoop/operatingLoopRunner.ts (refuses approval /
 *    preflight / verification / desktop_review stages)
 *  - lib/desktop/desktopAuthPolicy.ts (5-session cap, fingerprint
 *    validation)
 *  - lib/desktop/desktopToken.ts (HMAC + timing-safe compare)
 *
 * This module is the **declarative** contract — TypeScript literal
 * types prevent the safety flags from drifting to enabled later
 * without a visible PR change. Consumers (Trust Center, Command
 * Center, download page, operating loop) read from here.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";

// ---------------------------------------------------------------------------
// Role taxonomy — what desktop is for
// ---------------------------------------------------------------------------

export type DesktopCapability =
  | "plan_review"
  | "terraform_preview_review"
  | "cli_preview_review"
  | "remediation_review"
  | "simulation_review"
  | "approval_context_review"
  | "handoff_inbox"
  | "local_workspace_state"
  | "local_audit_sync"
  | "offline_plan_export"
  | "local_execution"            // intentionally listed so we can mark it blocked
  | "cloud_credential_storage"   // intentionally listed so we can mark it blocked
  | "approval_bypass";           // intentionally listed so we can mark it blocked

export type CapabilityStatus =
  | "available"
  | "preview"
  | "blocked_by_safety"
  | "blocked_by_config";

export interface DesktopCapabilityEntry {
  capability: DesktopCapability;
  status: CapabilityStatus;
  /** Honest one-liner the UI surfaces. */
  description: string;
}

// ---------------------------------------------------------------------------
// Product model
// ---------------------------------------------------------------------------

export interface DesktopProductModel {
  /** Honest role description rendered in Trust Center + download page. */
  role: "local_review_workstation";
  /** Always literal — safety contract encoded at the type level. */
  safety: {
    localExecutionEnabled: false;
    terraformApplyEnabled: false;
    cliApplyEnabled: false;
    cloudMutationEnabled: false;
    githubMutationEnabled: false;
    storesRawCloudCredentials: false;
    bypassesWebApproval: false;
    handoffSignatureRequired: true;
    handoffTtlEnforced: true;
    tenantScopeEnforced: true;
    auditEmittedOnHandoff: true;
  };
  /** Per-capability classification. */
  capabilities: DesktopCapabilityEntry[];
  /** What the operator sees in the Trust Center. */
  trustClaims: string[];
  /** Honest list of things the desktop will NOT do, ever, in this contract. */
  doesNotDo: string[];
  /** Acknowledgements a pilot operator should read before pairing a workstation. */
  requiredAcknowledgements: string[];
}

// ---------------------------------------------------------------------------
// Builder — composes the model honestly
// ---------------------------------------------------------------------------

export function buildDesktopProductModel(): DesktopProductModel {
  const env = loadAppEnv();

  return {
    role: "local_review_workstation",
    safety: {
      localExecutionEnabled: false,
      terraformApplyEnabled: false,
      cliApplyEnabled: false,
      cloudMutationEnabled: false,
      githubMutationEnabled: false,
      storesRawCloudCredentials: false,
      bypassesWebApproval: false,
      handoffSignatureRequired: true,
      handoffTtlEnforced: true,
      tenantScopeEnforced: true,
      auditEmittedOnHandoff: true,
    },
    capabilities: [
      cap("plan_review",                "available", "Open approved execution plans + read Terraform / CLI artifacts locally."),
      cap("terraform_preview_review",   "available", "Review the Terraform diff produced server-side — no apply path on desktop."),
      cap("cli_preview_review",         "available", "Review the per-resource CLI sequence — no execution on desktop."),
      cap("remediation_review",         "available", "Review candidate remediation context: severity, evidence, rollback plan, verification checklist."),
      cap("simulation_review",          "available", "Review the in-memory digital-twin diff produced by the simulation engine."),
      cap("approval_context_review",    "available", "Read the approval record + approver chain in context. Web approval flow remains canonical."),
      cap("handoff_inbox",              env.desktopHandoffSigningKeySet ? "available" : "preview", env.desktopHandoffSigningKeySet ? "Receive signed handoffs from the web platform." : "Handoff signer fallback to NEXTAUTH_SECRET — set DESKTOP_HANDOFF_SIGNING_KEY for explicit production posture."),
      cap("local_workspace_state",      "available", "Hydrate workspace session via paste-flow token in Settings."),
      cap("local_audit_sync",           "preview",  "Desktop ↔ web audit reconciliation is a future capability."),
      cap("offline_plan_export",        "preview",  "Drag-and-drop export of audit artefacts is preview; JSON export via /api/trust/export ships today."),
      // Hard-blocked capabilities — these flip require code changes that show up in PR diffs.
      cap("local_execution",            "blocked_by_safety", "Local apply (Terraform / CLI / cloud SDK) is permanently blocked in this product. Plans flow back to the web for approval-gated execution."),
      cap("cloud_credential_storage",   "blocked_by_safety", "Desktop does not store AWS / Azure / GCP / GitHub credentials. The cloud creds remain on the server boundary."),
      cap("approval_bypass",            "blocked_by_safety", "Desktop cannot approve or bypass approvals. Approval decisions are made on the web by the approver."),
    ],
    trustClaims: [
      "Desktop runs as a review workstation, not as a local cloud executor.",
      "Every handoff is HMAC-signed with a TTL — replay-rejection is built into the verifier.",
      "Session tokens are tenant-scoped and use timing-safe HMAC comparison.",
      "Local apply paths do not exist in the production build — adding them would require a visible PR change.",
      "No cloud provider credentials cross the web ↔ desktop boundary in the production build.",
    ],
    doesNotDo: [
      "Does NOT apply Terraform locally.",
      "Does NOT run cloud SDK calls against AWS / Azure / GCP from the desktop.",
      "Does NOT push changes to GitHub repositories.",
      "Does NOT store cloud credentials in the OS keychain or local files.",
      "Does NOT bypass the web approval workflow.",
      "Does NOT trigger production deployments.",
    ],
    requiredAcknowledgements: [
      "I understand the desktop app is a local review workstation, not a local cloud executor.",
      "I understand local apply paths do not exist and adding one would require a code change.",
      "I understand cloud credentials remain on the server boundary.",
      "I understand approvals are made on the web — the desktop is read-only for plans + approval context.",
      "I understand desktop binaries may not yet be publicly distributed for all platforms.",
    ],
  };
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function cap(capability: DesktopCapability, status: CapabilityStatus, description: string): DesktopCapabilityEntry {
  return { capability, status, description };
}
