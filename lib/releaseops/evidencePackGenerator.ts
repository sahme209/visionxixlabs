/**
 * Phase 475 — evidence pack content generator.
 *
 * Pure function that compiles every audit-relevant artifact for a
 * release into a single typed contentJson. The orchestrator
 * (evidencePackResponder) loads the inputs from Prisma + the
 * branch-validation evaluator + the diff helper, then calls this
 * function and writes the result to ReleaseEvidencePack.
 *
 * No I/O. Tests can construct the inputs directly.
 */

import { createHash } from "node:crypto";
import type { BranchValidationCheckResult } from "./branchValidationEvaluator";

/* ──────────────────────────────────────────────────────────────────
   Input shape — the orchestrator gathers these from the DB.
   ────────────────────────────────────────────────────────────── */

export interface EvidencePackInputRelease {
  id: string;
  organizationId: string;
  applicationId: string;
  status: string;
  releaseTag: string | null;
  commitSha: string | null;
  scopeFinalizedAt: Date | null;
  scopeFinalizedByUserId: string | null;
  plannedWindowStart: Date | null;
  plannedWindowEnd: Date | null;
  actualDeployStart: Date | null;
  actualDeployEnd: Date | null;
  summary: string | null;
  createdAt: Date;
}

export interface EvidencePackInputRepository {
  id: string;
  provider: string;
  remoteOwner: string;
  remoteName: string;
  defaultBranch: string;
}

export interface EvidencePackInputPr {
  id: string;
  number: number;
  title: string;
  state: string;
  mergedAt: Date | null;
  mergedByUserId: string | null;
  approvalsRequiredCount: number;
  approvalsObservedCount: number;
  codeownersApproved: boolean;
  ciStatus: string;
  linkedStories: string[];
  linkedTickets: string[];
  webUrl: string | null;
}

export interface EvidencePackInputCherryPick {
  id: string;
  status: string;
  rationale: string;
  approvedPrIds: string[];
  excludedPrIds: string[];
  hasFinalCommitValidation: boolean;
  requestedByUserId: string;
  requestedAt: Date;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  decisionReason: string | null;
}

export interface EvidencePackInputTicket {
  id: string;
  provider: string;
  externalKey: string;
  title: string;
  ticketType: string;
  status: string;
  priority: string;
  webUrl: string | null;
}

export interface EvidencePackInputReadiness {
  overallScore: number;
  riskLevel: string;
  branchGovernance: number;
  changeCompliance: number;
  artifactTraceability: number;
  secretTraceability: number;
  rollbackReadiness: number;
  communicationReadiness: number;
  driftRisk: number;
  manualReconciliation: number;
  evaluatedAt: Date;
  blockersJson: unknown;
  evaluationSource: string;
}

export interface EvidencePackGeneratorInput {
  release: EvidencePackInputRelease;
  repository: EvidencePackInputRepository | null;
  latestReadiness: EvidencePackInputReadiness | null;
  prs: ReadonlyArray<EvidencePackInputPr>;
  cherryPicks: ReadonlyArray<EvidencePackInputCherryPick>;
  linkedTickets: ReadonlyArray<EvidencePackInputTicket>;
  branchChecks: ReadonlyArray<BranchValidationCheckResult>;
}

/* ──────────────────────────────────────────────────────────────────
   Output shape — what gets stored in ReleaseEvidencePack.contentJson.
   ────────────────────────────────────────────────────────────── */

export interface EvidencePackContent {
  schemaVersion: 2;
  generatedAtIso: string;
  release: {
    id: string;
    applicationId: string;
    status: string;
    releaseTag: string | null;
    commitSha: string | null;
    scopeFinalizedAtIso: string | null;
    scopeFinalizedByUserId: string | null;
    plannedWindowStartIso: string | null;
    plannedWindowEndIso: string | null;
    actualDeployStartIso: string | null;
    actualDeployEndIso: string | null;
    summary: string | null;
    createdAtIso: string;
  };
  repository: {
    id: string;
    provider: string;
    displayName: string;
    defaultBranch: string;
  } | null;
  readiness: EvidencePackInputReadiness | null;
  branchValidation: {
    total: number;
    passing: number;
    failing: number;
    notApplicable: number;
    unknown: number;
    checks: ReadonlyArray<{
      key: string;
      state: "pass" | "fail" | "not_applicable" | "unknown";
      detail: string;
    }>;
  };
  pullRequests: {
    count: number;
    merged: number;
    open: number;
    closed: number;
    items: ReadonlyArray<{
      id: string;
      number: number;
      title: string;
      state: string;
      mergedAtIso: string | null;
      mergedByUserId: string | null;
      approvalsRequiredCount: number;
      approvalsObservedCount: number;
      codeownersApproved: boolean;
      ciStatus: string;
      linkedStories: string[];
      linkedTickets: string[];
      webUrl: string | null;
    }>;
  };
  cherryPicks: {
    count: number;
    byStatus: Record<string, number>;
    items: ReadonlyArray<{
      id: string;
      status: string;
      rationale: string;
      approvedPrIds: string[];
      excludedPrIds: string[];
      hasFinalCommitValidation: boolean;
      requestedByUserId: string;
      requestedAtIso: string;
      decidedByUserId: string | null;
      decidedAtIso: string | null;
      decisionReason: string | null;
    }>;
  };
  changeTickets: {
    count: number;
    byProvider: Record<string, number>;
    items: ReadonlyArray<{
      id: string;
      provider: string;
      externalKey: string;
      title: string;
      ticketType: string;
      status: string;
      priority: string;
      webUrl: string | null;
    }>;
  };
}

export interface EvidencePackGeneratorResult {
  content: EvidencePackContent;
  /** Hex SHA-256 of the canonical JSON for tamper-evidence. */
  contentHash: string;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export function generateEvidencePack(
  input: EvidencePackGeneratorInput,
  opts: { now?: Date } = {},
): EvidencePackGeneratorResult {
  const now = opts.now ?? new Date();

  const branchSummary = summarizeChecks(input.branchChecks);
  const prSummary = summarizePrs(input.prs);
  const cherrySummary = summarizeCherryPicks(input.cherryPicks);
  const ticketSummary = summarizeTickets(input.linkedTickets);

  const content: EvidencePackContent = {
    schemaVersion: 2,
    generatedAtIso: now.toISOString(),
    release: {
      id: input.release.id,
      applicationId: input.release.applicationId,
      status: input.release.status,
      releaseTag: input.release.releaseTag,
      commitSha: input.release.commitSha,
      scopeFinalizedAtIso: isoOrNull(input.release.scopeFinalizedAt),
      scopeFinalizedByUserId: input.release.scopeFinalizedByUserId,
      plannedWindowStartIso: isoOrNull(input.release.plannedWindowStart),
      plannedWindowEndIso: isoOrNull(input.release.plannedWindowEnd),
      actualDeployStartIso: isoOrNull(input.release.actualDeployStart),
      actualDeployEndIso: isoOrNull(input.release.actualDeployEnd),
      summary: input.release.summary,
      createdAtIso: input.release.createdAt.toISOString(),
    },
    repository: input.repository
      ? {
          id: input.repository.id,
          provider: input.repository.provider,
          displayName: `${input.repository.remoteOwner}/${input.repository.remoteName}`,
          defaultBranch: input.repository.defaultBranch,
        }
      : null,
    readiness: input.latestReadiness,
    branchValidation: branchSummary,
    pullRequests: prSummary,
    cherryPicks: cherrySummary,
    changeTickets: ticketSummary,
  };

  const contentHash = sha256OfCanonicalJson(content);
  return { content, contentHash };
}

/* ──────────────────────────────────────────────────────────────────
   Section summarizers.
   ────────────────────────────────────────────────────────────── */

function summarizeChecks(checks: ReadonlyArray<BranchValidationCheckResult>): EvidencePackContent["branchValidation"] {
  let passing = 0, failing = 0, notApplicable = 0, unknown = 0;
  const items = checks.map((c) => {
    if (c.state === "pass") passing += 1;
    else if (c.state === "fail") failing += 1;
    else if (c.state === "not_applicable") notApplicable += 1;
    else unknown += 1;
    return { key: c.key, state: c.state, detail: c.detail };
  });
  return { total: checks.length, passing, failing, notApplicable, unknown, checks: items };
}

function summarizePrs(prs: ReadonlyArray<EvidencePackInputPr>): EvidencePackContent["pullRequests"] {
  let merged = 0, open = 0, closed = 0;
  const items = prs.map((p) => {
    if (p.state === "merged") merged += 1;
    else if (p.state === "open") open += 1;
    else if (p.state === "closed") closed += 1;
    return {
      id: p.id,
      number: p.number,
      title: p.title,
      state: p.state,
      mergedAtIso: isoOrNull(p.mergedAt),
      mergedByUserId: p.mergedByUserId,
      approvalsRequiredCount: p.approvalsRequiredCount,
      approvalsObservedCount: p.approvalsObservedCount,
      codeownersApproved: p.codeownersApproved,
      ciStatus: p.ciStatus,
      linkedStories: p.linkedStories,
      linkedTickets: p.linkedTickets,
      webUrl: p.webUrl,
    };
  });
  return { count: prs.length, merged, open, closed, items };
}

function summarizeCherryPicks(cps: ReadonlyArray<EvidencePackInputCherryPick>): EvidencePackContent["cherryPicks"] {
  const byStatus: Record<string, number> = {};
  const items = cps.map((c) => {
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    return {
      id: c.id,
      status: c.status,
      rationale: c.rationale,
      approvedPrIds: c.approvedPrIds,
      excludedPrIds: c.excludedPrIds,
      hasFinalCommitValidation: c.hasFinalCommitValidation,
      requestedByUserId: c.requestedByUserId,
      requestedAtIso: c.requestedAt.toISOString(),
      decidedByUserId: c.decidedByUserId,
      decidedAtIso: isoOrNull(c.decidedAt),
      decisionReason: c.decisionReason,
    };
  });
  return { count: cps.length, byStatus, items };
}

function summarizeTickets(tickets: ReadonlyArray<EvidencePackInputTicket>): EvidencePackContent["changeTickets"] {
  const byProvider: Record<string, number> = {};
  for (const t of tickets) byProvider[t.provider] = (byProvider[t.provider] ?? 0) + 1;
  return {
    count: tickets.length,
    byProvider,
    items: tickets.map((t) => ({
      id: t.id,
      provider: t.provider,
      externalKey: t.externalKey,
      title: t.title,
      ticketType: t.ticketType,
      status: t.status,
      priority: t.priority,
      webUrl: t.webUrl,
    })),
  };
}

/* ──────────────────────────────────────────────────────────────────
   Tamper-evident content hash.
   ────────────────────────────────────────────────────────────── */

export function sha256OfCanonicalJson(content: unknown): string {
  // Stable, sorted-key JSON so the hash is deterministic regardless
  // of insertion order — important for tamper-evidence.
  const canonical = canonicalize(content);
  return createHash("sha256").update(canonical).digest("hex");
}

function canonicalize(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalize).join(",")}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(",")}}`;
}

function isoOrNull(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}
