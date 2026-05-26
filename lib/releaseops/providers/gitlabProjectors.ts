/**
 * Phase 453 — GitLab API → discovery-row projectors.
 *
 * Sibling to githubProjectors. Maps GitLab REST shapes (merge_requests,
 * tags / releases, pipelines / jobs) into the same UpsertPrInput /
 * UpsertReleaseTagInput / UpsertWorkflowRunInput rows. Pure
 * functions; tests pin every field-mapping decision.
 */

import type {
  UpsertPrInput,
  UpsertReleaseTagInput,
  UpsertWorkflowRunInput,
  PrState,
  CiStatus,
  WorkflowRunStatus,
  WorkflowRunConclusion,
  WorkflowRunKind,
} from "../gitDiscoveryRepo";
import { classifyRunKind } from "./githubProjectors";

/* ──────────────────────────────────────────────────────────────────
   GitLab Merge Request → PR row.
   ────────────────────────────────────────────────────────────── */

export interface GitlabMergeRequestPayload {
  iid: number;                                  // project-local id
  title: string;
  description?: string | null;
  /** Merge request state: opened | closed | merged | locked */
  state: "opened" | "closed" | "merged" | "locked";
  source_branch: string;
  target_branch: string;
  sha: string;
  merged_at?: string | null;
  merged_by?: { username: string } | null;
  author: { username: string };
  web_url: string;
  labels?: ReadonlyArray<string>;
  /** Approval rule counts from /approvals or /approval_rules. */
  approvalsRequiredCount?: number;
  approvalsObservedCount?: number;
  codeownersApproved?: boolean;
  /** Latest head pipeline status. */
  headPipelineStatus?:
    | "created" | "waiting_for_resource" | "preparing" | "pending"
    | "running" | "success" | "failed" | "canceled" | "skipped"
    | "manual" | "scheduled" | null;
}

export function projectGitlabMergeRequest(
  payload: GitlabMergeRequestPayload,
  context: { organizationId: string; repositoryId: string },
): UpsertPrInput {
  const state = projectMrState(payload);
  const ciStatus = projectGitlabPipelineToCiStatus(payload.headPipelineStatus ?? null);
  const body = payload.description ?? "";
  const labels = payload.labels ?? [];
  const linkedStories = extractStories(body, labels);
  const linkedTickets = extractTickets(body, labels);

  return {
    organizationId: context.organizationId,
    repositoryId: context.repositoryId,
    number: payload.iid,
    title: payload.title,
    state,
    sourceBranch: payload.source_branch,
    targetBranch: payload.target_branch,
    commitShaHead: payload.sha,
    mergedAt: payload.merged_at ? new Date(payload.merged_at) : null,
    mergedByUserId: payload.merged_by?.username ?? null,
    linkedStories,
    linkedTickets,
    approvalsRequiredCount: payload.approvalsRequiredCount ?? 0,
    approvalsObservedCount: payload.approvalsObservedCount ?? 0,
    codeownersApproved: payload.codeownersApproved ?? false,
    ciStatus,
    webUrl: payload.web_url,
  };
}

function projectMrState(p: GitlabMergeRequestPayload): PrState {
  if (p.state === "merged" || p.merged_at) return "merged";
  if (p.state === "closed" || p.state === "locked") return "closed";
  return "open";
}

export function projectGitlabPipelineToCiStatus(
  s: GitlabMergeRequestPayload["headPipelineStatus"] | null,
): CiStatus {
  switch (s) {
    case "success":  return "passing";
    case "failed":
    case "canceled": return "failing";
    case "running":
    case "pending":
    case "preparing":
    case "created":
    case "waiting_for_resource":
    case "scheduled":
    case "manual":   return "pending";
    case "skipped":  return "not_run";
    case null:
    case undefined: return "not_run";
  }
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

/* ──────────────────────────────────────────────────────────────────
   GitLab Release / Tag → ReleaseTagRecord.
   ────────────────────────────────────────────────────────────── */

export interface GitlabReleaseTagPayload {
  tag_name: string;
  /** Resolved commit SHA at the tag. */
  commit: { id: string };
  released_at?: string | null;
  created_at?: string;
  description?: string | null;
  author?: { username: string } | null;
  prListSincePrevious?: ReadonlyArray<string>;
  commitListSincePrevious?: ReadonlyArray<string>;
}

export function projectGitlabReleaseTag(
  payload: GitlabReleaseTagPayload,
  context: { organizationId: string; repositoryId: string },
): UpsertReleaseTagInput {
  const createdAtIso = payload.released_at ?? payload.created_at ?? null;
  return {
    organizationId: context.organizationId,
    repositoryId: context.repositoryId,
    tagName: payload.tag_name,
    commitSha: payload.commit.id,
    createdAt: createdAtIso ? new Date(createdAtIso) : new Date(),
    taggerUserId: payload.author?.username ?? null,
    prListJson: payload.prListSincePrevious ? Array.from(payload.prListSincePrevious) : null,
    commitListJson: payload.commitListSincePrevious ? Array.from(payload.commitListSincePrevious) : null,
    diffAgainstPreviousProdJson: null,
    notes: payload.description ?? null,
  };
}

/* ──────────────────────────────────────────────────────────────────
   GitLab Pipeline → WorkflowRunRecord.
   ────────────────────────────────────────────────────────────── */

export interface GitlabPipelinePayload {
  id: number;
  /** Pipeline reference name, e.g. branch or tag. */
  ref?: string | null;
  sha: string;
  status:
    | "created" | "waiting_for_resource" | "preparing" | "pending"
    | "running" | "success" | "failed" | "canceled" | "skipped"
    | "manual" | "scheduled";
  /** Optional name — GitLab pipelines don't have a stable name; callers can pass file path or "default". */
  pipelineName?: string;
  /** Source file path of the .gitlab-ci.yml stage (used by classifyRunKind). */
  configPath?: string;
  created_at?: string;
  started_at?: string | null;
  finished_at?: string | null;
  web_url: string;
}

export function projectGitlabPipeline(
  payload: GitlabPipelinePayload,
  context: { organizationId: string; repositoryId: string },
): UpsertWorkflowRunInput {
  const [status, conclusion] = projectGitlabPipelineStatus(payload.status);
  const name = payload.pipelineName ?? payload.configPath ?? ".gitlab-ci.yml";
  const path = payload.configPath ?? ".gitlab-ci.yml";
  const runKind: WorkflowRunKind = classifyRunKind(path, name);
  return {
    organizationId: context.organizationId,
    repositoryId: context.repositoryId,
    workflowName: name,
    externalRunId: String(payload.id),
    status,
    conclusion,
    runKind,
    commitSha: payload.sha,
    ref: payload.ref ?? null,
    startedAt: payload.started_at ? new Date(payload.started_at) : null,
    completedAt: payload.finished_at ? new Date(payload.finished_at) : null,
    webUrl: payload.web_url,
    artifactsJson: null,
  };
}

export function projectGitlabPipelineStatus(
  s: GitlabPipelinePayload["status"],
): [WorkflowRunStatus, WorkflowRunConclusion | null] {
  switch (s) {
    case "created":
    case "waiting_for_resource":
    case "preparing":
    case "pending":
    case "manual":
    case "scheduled":             return ["queued", null];
    case "running":               return ["in_progress", null];
    case "success":               return ["completed", "success"];
    case "failed":                return ["completed", "failure"];
    case "canceled":              return ["completed", "cancelled"];
    case "skipped":               return ["completed", "skipped"];
  }
}
