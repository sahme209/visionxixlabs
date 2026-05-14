/**
 * Audit bundle export engine.
 *
 * Compliance reviewers and security teams expect more than a raw log dump.
 * A bundle is a coherent record of a single operation — its actors, the
 * policies that applied, the approvals that were granted, the artifacts
 * produced, and the evidence behind the decision.
 *
 * This module composes a bundle from typed inputs (audit story + trace +
 * evidence + artifacts) and serialises to JSON or CSV. PDF rendering is
 * intentionally *not* implemented — the contract carries a `format` field
 * so a future renderer can plug in without changing call sites.
 */

import { redactDeep } from "@/lib/security/redaction";
import type { AuditStory, StoryActor, StoryRiskLevel } from "./auditIntelligence";
import type { OperationTrace } from "@/lib/tracing/operationTrace";
import type { DataSource } from "@/lib/domain/source";

// ---------------------------------------------------------------------------
// Bundle taxonomy
// ---------------------------------------------------------------------------

export type AuditBundleKind =
  | "provider_connection"
  | "cloud_scan"
  | "recommendation"
  | "execution_plan"
  | "approval_decision"
  | "terraform_export"
  | "rollback_plan"
  | "verification_result"
  | "releaseops_readiness"
  | "github_sync"
  | "desktop_handoff"
  | "policy_decision"
  | "copilot_recommendation";

export type AuditBundleFormat = "json" | "csv" | "ndjson" | "pdf";

export const SUPPORTED_FORMATS: AuditBundleFormat[] = ["json", "csv", "ndjson"];

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface ArtifactRef {
  id: string;
  kind: "terraform" | "cli" | "rollback" | "snapshot" | "policy_decision" | "approval" | "execution_plan" | "report";
  label: string;
  /** Free-form summary already redacted. */
  summary?: string;
  /** Internal href (e.g. `/dashboard/execution/abc`). */
  href?: string;
  /** Optional checksum for integrity. */
  checksum?: string;
}

export interface PolicyDecisionRef {
  ruleId: string;
  ruleLabel: string;
  decision: "allow" | "block" | "require_approval" | "warn";
  reason: string;
}

export interface ApprovalRef {
  approvalId: string;
  decision: "granted" | "denied" | "pending";
  approver?: string;
  decidedAt?: string;
  reason?: string;
}

export interface ResourceRef {
  id: string;
  kind: string;
  label: string;
  provider?: string;
  region?: string;
}

export interface AuditBundleInput {
  kind: AuditBundleKind;
  story: AuditStory;
  trace?: OperationTrace;
  artifacts: ArtifactRef[];
  policies: PolicyDecisionRef[];
  approvals: ApprovalRef[];
  resources: ResourceRef[];
  /** Source tag — usually inherited from the story. */
  source?: DataSource;
}

// ---------------------------------------------------------------------------
// Bundle record
// ---------------------------------------------------------------------------

export interface AuditBundleSummary {
  title: string;
  description: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  risk: StoryRiskLevel;
  actors: StoryActor[];
  hasBlockedAction: boolean;
  approvalGranted?: boolean;
  approvalDenied?: boolean;
}

export interface AuditBundle {
  id: string;
  organizationId: string;
  kind: AuditBundleKind;
  correlationId: string;
  source: DataSource;
  generatedAt: string;
  summary: AuditBundleSummary;
  timeline: AuditStory["timeline"];
  artifacts: ArtifactRef[];
  policies: PolicyDecisionRef[];
  approvals: ApprovalRef[];
  resources: ResourceRef[];
  trace?: OperationTrace;
  /** Notice that everything inside the bundle has been redacted. */
  redactionNotice: string;
}

let _seq = 0;
function newBundleId(): string {
  _seq = (_seq + 1) % 1_000_000;
  return `bundle_${Date.now().toString(36)}_${_seq.toString(36).padStart(4, "0")}`;
}

const REDACTION_NOTICE =
  "All free-text fields, attributes, and artifact summaries have passed through the Axiom redaction pipeline. " +
  "Raw credentials, tokens, private keys, and provider responses are never included in audit bundles.";

/**
 * Build a typed bundle from the input set. Pure — does no IO. Caller is
 * responsible for persisting / serving the result.
 */
export function buildAuditBundle(input: AuditBundleInput): AuditBundle {
  const durationMs = Math.max(0, Date.parse(input.story.endedAt) - Date.parse(input.story.startedAt));
  const redactedTrace = input.trace
    ? ({ ...input.trace, evidence: input.trace.evidence.map((e) => ({ ...e, summary: e.summary ? (redactDeep(e.summary) as unknown as string) : undefined })) } as OperationTrace)
    : undefined;
  return {
    id: newBundleId(),
    organizationId: input.story.organizationId as unknown as string,
    kind: input.kind,
    correlationId: input.story.correlationId as unknown as string,
    source: input.source ?? input.story.source,
    generatedAt: new Date().toISOString(),
    summary: {
      title: input.story.title,
      description: input.story.summary,
      startedAt: input.story.startedAt,
      endedAt: input.story.endedAt,
      durationMs,
      risk: input.story.risk,
      actors: input.story.actors,
      hasBlockedAction: input.story.hasBlockedAction,
      approvalGranted: input.story.approvalGranted,
      approvalDenied: input.story.approvalDenied,
    },
    timeline: input.story.timeline,
    artifacts: input.artifacts.map((a) => ({ ...a, summary: a.summary ? (redactDeep(a.summary) as unknown as string) : undefined })),
    policies: input.policies,
    approvals: input.approvals,
    resources: input.resources,
    trace: redactedTrace,
    redactionNotice: REDACTION_NOTICE,
  };
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

export interface SerializedBundle {
  format: AuditBundleFormat;
  contentType: string;
  body: string;
  filename: string;
}

export function serializeBundle(bundle: AuditBundle, format: AuditBundleFormat): SerializedBundle {
  if (format === "pdf") {
    // Don't pretend. Return a tiny JSON envelope that names the bundle so a
    // future PDF renderer can read it and produce the real document.
    return {
      format,
      contentType: "application/json",
      body: JSON.stringify({ bundle, note: "PDF rendering is not yet implemented — serve this bundle through the future renderer." }, null, 2),
      filename: `${bundle.id}.pdf.placeholder.json`,
    };
  }
  if (format === "json") {
    return {
      format,
      contentType: "application/json",
      body: JSON.stringify(bundle, null, 2),
      filename: `${bundle.id}.json`,
    };
  }
  if (format === "ndjson") {
    const lines = [
      JSON.stringify({ section: "summary", ...bundle.summary }),
      ...bundle.timeline.map((t) => JSON.stringify({ section: "timeline", ...t })),
      ...bundle.policies.map((p) => JSON.stringify({ section: "policy", ...p })),
      ...bundle.approvals.map((a) => JSON.stringify({ section: "approval", ...a })),
      ...bundle.artifacts.map((a) => JSON.stringify({ section: "artifact", ...a })),
      ...bundle.resources.map((r) => JSON.stringify({ section: "resource", ...r })),
    ];
    return {
      format,
      contentType: "application/x-ndjson",
      body: lines.join("\n"),
      filename: `${bundle.id}.ndjson`,
    };
  }
  // csv — flat-rows of timeline (most common reviewer ask)
  const header = ["recordId", "action", "outcome", "occurredAt", "actorKind", "actor", "detail"].join(",");
  const rows = bundle.timeline.map((t) => [
    csv(t.recordId),
    csv(t.action),
    csv(t.outcome),
    csv(t.occurredAt),
    csv(t.actor.kind),
    csv(t.actor.userId ?? t.actor.label),
    csv(t.detailLine ?? ""),
  ].join(","));
  return {
    format,
    contentType: "text/csv",
    body: [header, ...rows].join("\n"),
    filename: `${bundle.id}.csv`,
  };
}

function csv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const BUNDLE_KIND_LABEL: Record<AuditBundleKind, string> = {
  provider_connection:    "Provider connection",
  cloud_scan:             "Cloud scan",
  recommendation:         "Recommendation",
  execution_plan:         "Execution plan",
  approval_decision:      "Approval decision",
  terraform_export:       "Terraform export",
  rollback_plan:          "Rollback plan",
  verification_result:    "Verification result",
  releaseops_readiness:   "ReleaseOps readiness",
  github_sync:            "GitHub sync",
  desktop_handoff:        "Desktop handoff",
  policy_decision:        "Policy decision",
  copilot_recommendation: "Copilot recommendation",
};
