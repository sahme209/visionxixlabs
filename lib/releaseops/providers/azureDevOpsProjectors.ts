/**
 * Phase 454 — Azure DevOps API → discovery-row projectors.
 *
 * Third member of the provider-projector family. Maps Azure DevOps
 * REST shapes (pull requests, tags / annotated tag refs, pipeline
 * runs) into the Phase 451 upsert inputs.
 *
 * Notable quirks vs GitHub/GitLab:
 *   - ADO PR status is { active | abandoned | completed }
 *   - PRs use `pullRequestId` (project-wide unique) instead of
 *     a repo-local number; we still store it as `number`
 *   - tag refs require a separate /git/annotatedTags call to resolve
 *     the commit when the tag is annotated; the projector accepts
 *     the resolved sha
 *   - pipeline runs (Pipelines API) use { state, result } pair
 */

import type {
  UpsertPrInput,
  UpsertReleaseTagInput,
  UpsertWorkflowRunInput,
  PrState,
  CiStatus,
  WorkflowRunStatus,
  WorkflowRunConclusion,
} from "../gitDiscoveryRepo";
import { classifyRunKind } from "./githubProjectors";

/* ──────────────────────────────────────────────────────────────────
   PR projector.
   ────────────────────────────────────────────────────────────── */

export interface AdoPullRequestPayload {
  pullRequestId: number;
  title: string;
  description?: string | null;
  status: "active" | "abandoned" | "completed";
  /** isDraft flag if the operator marked it WIP. */
  isDraft?: boolean;
  sourceRefName: string;             // e.g. "refs/heads/feat/x"
  targetRefName: string;             // e.g. "refs/heads/main"
  lastMergeSourceCommit: { commitId: string };
  closedDate?: string | null;        // populated when status=completed
  closedBy?: { uniqueName?: string; displayName?: string } | null;
  createdBy: { uniqueName?: string; displayName?: string };
  /** Approval state from the policy evaluation. */
  approvalsRequiredCount?: number;
  approvalsObservedCount?: number;
  codeownersApproved?: boolean;
  /** Latest build status from the linked build policy. */
  buildStatus?: "succeeded" | "failed" | "partiallySucceeded" | "inProgress" | "notStarted" | "canceled" | null;
  /** Tags array on the PR. */
  labels?: ReadonlyArray<{ name: string }>;
  /** ADO Boards work items linked to the PR. */
  workItemRefs?: ReadonlyArray<{ id: string }>;
  /** Web URL — typically constructed by the caller; required field on row. */
  webUrl: string;
}

export function projectAdoPullRequest(
  payload: AdoPullRequestPayload,
  context: { organizationId: string; repositoryId: string },
): UpsertPrInput {
  const state = projectAdoPrState(payload);
  const ciStatus = projectAdoBuildStatus(payload.buildStatus ?? null);
  const body = payload.description ?? "";
  const labelStrings = (payload.labels ?? []).map((l) => l.name);
  const workItemIds = (payload.workItemRefs ?? []).map((w) => w.id);
  return {
    organizationId: context.organizationId,
    repositoryId: context.repositoryId,
    number: payload.pullRequestId,
    title: payload.title,
    state,
    sourceBranch: stripRefsHeads(payload.sourceRefName),
    targetBranch: stripRefsHeads(payload.targetRefName),
    commitShaHead: payload.lastMergeSourceCommit.commitId,
    mergedAt: payload.status === "completed" && payload.closedDate ? new Date(payload.closedDate) : null,
    mergedByUserId: payload.status === "completed"
      ? (payload.closedBy?.uniqueName ?? payload.closedBy?.displayName ?? null)
      : null,
    linkedStories: dedupeStories(extractStories(body, labelStrings).concat(workItemIds)),
    linkedTickets: extractTickets(body, labelStrings),
    approvalsRequiredCount: payload.approvalsRequiredCount ?? 0,
    approvalsObservedCount: payload.approvalsObservedCount ?? 0,
    codeownersApproved: payload.codeownersApproved ?? false,
    ciStatus,
    webUrl: payload.webUrl,
  };
}

function projectAdoPrState(p: AdoPullRequestPayload): PrState {
  if (p.status === "completed") return "merged";
  if (p.status === "abandoned") return "closed";
  return "open";   // active (including drafts)
}

export function projectAdoBuildStatus(
  s: AdoPullRequestPayload["buildStatus"] | null,
): CiStatus {
  switch (s) {
    case "succeeded":           return "passing";
    case "failed":
    case "partiallySucceeded":
    case "canceled":            return "failing";
    case "inProgress":
    case "notStarted":          return "pending";
    case null:
    case undefined:             return "not_run";
  }
}

function stripRefsHeads(ref: string): string {
  if (ref.startsWith("refs/heads/")) return ref.slice("refs/heads/".length);
  if (ref.startsWith("refs/tags/")) return ref.slice("refs/tags/".length);
  return ref;
}

const STORY_PATTERN = /\b([A-Z]+-\d+)\b/g;
const TICKET_PATTERN = /\b(CHG\d{4,}|INC\d{4,}|REQ\d{4,})\b/g;

function extractStories(body: string, labels: ReadonlyArray<string>): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(STORY_PATTERN)) {
    const k = m[1];
    if (!k.startsWith("CHG") && !k.startsWith("INC") && !k.startsWith("REQ")) out.add(k);
  }
  for (const l of labels) {
    const m = l.match(/^([A-Z]+-\d+)$/);
    if (m && !m[1].startsWith("CHG") && !m[1].startsWith("INC") && !m[1].startsWith("REQ")) out.add(m[1]);
  }
  return Array.from(out);
}

function extractTickets(body: string, labels: ReadonlyArray<string>): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(TICKET_PATTERN)) out.add(m[1]);
  for (const l of labels) if (/^(CHG|INC|REQ)\d{4,}$/.test(l)) out.add(l);
  return Array.from(out);
}

function dedupeStories(items: ReadonlyArray<string>): string[] {
  return Array.from(new Set(items.filter((s) => s.length > 0)));
}

/* ──────────────────────────────────────────────────────────────────
   Release tag projector.
   ────────────────────────────────────────────────────────────── */

export interface AdoReleaseTagPayload {
  /** Display tag name without refs/tags/. */
  tagName: string;
  resolvedCommitSha: string;
  taggedAt?: string;
  message?: string | null;
  tagger?: { uniqueName?: string; displayName?: string } | null;
  prListSincePrevious?: ReadonlyArray<string>;
  commitListSincePrevious?: ReadonlyArray<string>;
}

export function projectAdoReleaseTag(
  payload: AdoReleaseTagPayload,
  context: { organizationId: string; repositoryId: string },
): UpsertReleaseTagInput {
  return {
    organizationId: context.organizationId,
    repositoryId: context.repositoryId,
    tagName: payload.tagName,
    commitSha: payload.resolvedCommitSha,
    createdAt: payload.taggedAt ? new Date(payload.taggedAt) : new Date(),
    taggerUserId: payload.tagger?.uniqueName ?? payload.tagger?.displayName ?? null,
    prListJson: payload.prListSincePrevious ? Array.from(payload.prListSincePrevious) : null,
    commitListJson: payload.commitListSincePrevious ? Array.from(payload.commitListSincePrevious) : null,
    diffAgainstPreviousProdJson: null,
    notes: payload.message ?? null,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Pipeline run projector.
   ────────────────────────────────────────────────────────────── */

export interface AdoPipelineRunPayload {
  id: number;
  name?: string | null;
  /** Pipeline YAML path; used to classify runKind. */
  yamlPath?: string;
  state: "unknown" | "inProgress" | "completed" | "canceling" | "cancelling" | "postponed" | "notStarted";
  result?: "succeeded" | "failed" | "partiallySucceeded" | "canceled" | "abandoned" | null;
  /** Source branch / tag ref like "refs/heads/main". */
  sourceBranch?: string | null;
  /** Resolved commit SHA. */
  sourceSha?: string | null;
  createdDate?: string;
  finishedDate?: string | null;
  webUrl: string;
}

export function projectAdoPipelineRun(
  payload: AdoPipelineRunPayload,
  context: { organizationId: string; repositoryId: string },
): UpsertWorkflowRunInput {
  const status = projectAdoRunStatus(payload.state);
  const conclusion = projectAdoRunConclusion(payload.result ?? null);
  const name = payload.name ?? payload.yamlPath ?? "azure-pipelines";
  const path = payload.yamlPath ?? "azure-pipelines.yml";
  return {
    organizationId: context.organizationId,
    repositoryId: context.repositoryId,
    workflowName: name,
    externalRunId: String(payload.id),
    status,
    conclusion,
    runKind: classifyRunKind(path, name),
    commitSha: payload.sourceSha ?? null,
    ref: payload.sourceBranch ? stripRefsHeads(payload.sourceBranch) : null,
    startedAt: payload.createdDate ? new Date(payload.createdDate) : null,
    completedAt: status === "completed" && payload.finishedDate ? new Date(payload.finishedDate) : null,
    webUrl: payload.webUrl,
    artifactsJson: null,
  };
}

function projectAdoRunStatus(s: AdoPipelineRunPayload["state"]): WorkflowRunStatus {
  switch (s) {
    case "notStarted":
    case "postponed":
    case "unknown":     return "queued";
    case "inProgress":
    case "canceling":
    case "cancelling":  return "in_progress";
    case "completed":   return "completed";
  }
}

function projectAdoRunConclusion(
  r: AdoPipelineRunPayload["result"] | null,
): WorkflowRunConclusion | null {
  switch (r) {
    case "succeeded":           return "success";
    case "failed":
    case "partiallySucceeded":  return "failure";
    case "canceled":            return "cancelled";
    case "abandoned":           return "cancelled";
    case null:
    case undefined:             return null;
  }
}
