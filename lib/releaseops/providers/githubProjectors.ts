/**
 * Phase 452 — GitHub API → discovery-row projectors.
 *
 * Pure functions that map the GitHub REST API JSON shape into the
 * UpsertPrInput / UpsertReleaseTagInput / UpsertWorkflowRunInput
 * shapes the Phase 451 repo accepts. No HTTP. No I/O. Tests pin
 * every field-mapping decision and every closed-union normalization.
 *
 * The HTTP fetcher (a separate file) calls these projectors after
 * receiving the JSON; the test surface stays deterministic because
 * the projectors don't touch the network.
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

/* ──────────────────────────────────────────────────────────────────
   GitHub PR shape (subset we care about).
   ────────────────────────────────────────────────────────────── */

export interface GithubPrPayload {
  number: number;
  title: string;
  body?: string | null;
  state: "open" | "closed";
  merged_at: string | null;
  merged_by?: { login: string } | null;
  head: { ref: string; sha: string };
  base: { ref: string };
  user: { login: string };
  html_url: string;
  labels?: ReadonlyArray<{ name: string }>;
  /** Required-reviews + observed counts come from a separate review API call. */
  requestedReviewerCount?: number;
  observedApprovalCount?: number;
  codeownersApproved?: boolean;
  /** CI status comes from the combined-status endpoint. */
  ciCombinedState?: "pending" | "success" | "failure" | "error" | null;
}

export function projectGithubPr(
  payload: GithubPrPayload,
  context: { organizationId: string; repositoryId: string },
): UpsertPrInput {
  const state = projectPrState(payload);
  const ciStatus = projectCiStatus(payload.ciCombinedState ?? null);
  const linkedStories = extractLinkedStories(payload.body ?? "", payload.labels ?? []);
  const linkedTickets = extractLinkedTickets(payload.body ?? "", payload.labels ?? []);
  return {
    organizationId: context.organizationId,
    repositoryId: context.repositoryId,
    number: payload.number,
    title: payload.title,
    state,
    sourceBranch: payload.head.ref,
    targetBranch: payload.base.ref,
    commitShaHead: payload.head.sha,
    mergedAt: payload.merged_at ? new Date(payload.merged_at) : null,
    mergedByUserId: payload.merged_by?.login ?? null,
    linkedStories,
    linkedTickets,
    approvalsRequiredCount: payload.requestedReviewerCount ?? 0,
    approvalsObservedCount: payload.observedApprovalCount ?? 0,
    codeownersApproved: payload.codeownersApproved ?? false,
    ciStatus,
    webUrl: payload.html_url,
  };
}

function projectPrState(p: GithubPrPayload): PrState {
  if (p.merged_at) return "merged";
  if (p.state === "closed") return "closed";
  return "open";
}

function projectCiStatus(s: GithubPrPayload["ciCombinedState"] | null): CiStatus {
  switch (s) {
    case "success": return "passing";
    case "failure":
    case "error":   return "failing";
    case "pending": return "pending";
    case null:
    case undefined: return "not_run";
  }
}

const STORY_PATTERN = /\b([A-Z]+-\d+)\b/g;
const TICKET_PATTERN = /\b(CHG\d{4,}|INC\d{4,}|REQ\d{4,})\b/g;

function extractLinkedStories(body: string, labels: ReadonlyArray<{ name: string }>): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(STORY_PATTERN)) {
    const key = m[1];
    if (!key.startsWith("CHG") && !key.startsWith("INC") && !key.startsWith("REQ")) out.add(key);
  }
  for (const l of labels) {
    if (STORY_PATTERN.test(l.name) && !l.name.startsWith("CHG")) out.add(l.name);
  }
  return Array.from(out);
}

function extractLinkedTickets(body: string, labels: ReadonlyArray<{ name: string }>): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(TICKET_PATTERN)) out.add(m[1]);
  for (const l of labels) if (/^(CHG|INC|REQ)\d{4,}$/.test(l.name)) out.add(l.name);
  return Array.from(out);
}

/* ──────────────────────────────────────────────────────────────────
   GitHub release-tag shape.
   ────────────────────────────────────────────────────────────── */

export interface GithubReleaseTagPayload {
  tag_name: string;
  name?: string | null;
  target_commitish: string;
  /** Filled-in by a separate /git/refs/tags lookup or /git/tag for annotated tags. */
  resolvedCommitSha: string;
  created_at?: string;
  body?: string | null;
  author?: { login: string } | null;
  /** Optional projection of the PR list since the previous prod tag. */
  prListSincePrevious?: ReadonlyArray<string>;
  commitListSincePrevious?: ReadonlyArray<string>;
}

export function projectGithubReleaseTag(
  payload: GithubReleaseTagPayload,
  context: { organizationId: string; repositoryId: string },
): UpsertReleaseTagInput {
  return {
    organizationId: context.organizationId,
    repositoryId: context.repositoryId,
    tagName: payload.tag_name,
    commitSha: payload.resolvedCommitSha,
    createdAt: payload.created_at ? new Date(payload.created_at) : new Date(),
    taggerUserId: payload.author?.login ?? null,
    prListJson: payload.prListSincePrevious ? Array.from(payload.prListSincePrevious) : null,
    commitListJson: payload.commitListSincePrevious ? Array.from(payload.commitListSincePrevious) : null,
    diffAgainstPreviousProdJson: null,
    notes: payload.body ?? null,
  };
}

/* ──────────────────────────────────────────────────────────────────
   GitHub Actions workflow-run shape.
   ────────────────────────────────────────────────────────────── */

export interface GithubWorkflowRunPayload {
  id: number;
  name?: string | null;
  /** Path within the repo, e.g. ".github/workflows/deploy.yml" */
  path: string;
  status: "queued" | "in_progress" | "completed" | "waiting" | "pending" | "requested";
  conclusion?: "success" | "failure" | "cancelled" | "skipped" | "neutral" | "timed_out" | "action_required" | null;
  head_sha: string;
  head_branch?: string | null;
  /** Tags appear here when the workflow was triggered by a tag push. */
  display_title?: string;
  run_started_at?: string | null;
  updated_at?: string | null;
  html_url: string;
}

export function projectGithubWorkflowRun(
  payload: GithubWorkflowRunPayload,
  context: { organizationId: string; repositoryId: string },
): UpsertWorkflowRunInput {
  const status = normalizeWorkflowStatus(payload.status);
  const conclusion = normalizeWorkflowConclusion(payload.conclusion ?? null);
  const runKind = classifyRunKind(payload.path, payload.name ?? "");
  return {
    organizationId: context.organizationId,
    repositoryId: context.repositoryId,
    workflowName: payload.name ?? payload.path,
    externalRunId: String(payload.id),
    status,
    conclusion,
    runKind,
    commitSha: payload.head_sha,
    ref: payload.head_branch ?? null,
    startedAt: payload.run_started_at ? new Date(payload.run_started_at) : null,
    completedAt: status === "completed" && payload.updated_at ? new Date(payload.updated_at) : null,
    webUrl: payload.html_url,
    artifactsJson: null,
  };
}

function normalizeWorkflowStatus(s: GithubWorkflowRunPayload["status"]): WorkflowRunStatus {
  switch (s) {
    case "queued":
    case "waiting":
    case "pending":
    case "requested":     return "queued";
    case "in_progress":   return "in_progress";
    case "completed":     return "completed";
  }
}

function normalizeWorkflowConclusion(
  c: GithubWorkflowRunPayload["conclusion"] | null,
): WorkflowRunConclusion | null {
  if (c === null || c === undefined) return null;
  switch (c) {
    case "success":         return "success";
    case "failure":         return "failure";
    case "cancelled":       return "cancelled";
    case "skipped":         return "skipped";
    case "neutral":         return "neutral";
    case "timed_out":       return "failure";        // collapse — failure-shaped outcome
    case "action_required": return "failure";        // collapse — needs operator
  }
}

const DEPLOY_HINTS = /\b(deploy|release|publish|ship)\b/i;
const BUILD_HINTS  = /\b(build|compile|package|docker|image)\b/i;
const CHECK_HINTS  = /\b(test|lint|check|verify|ci|qa)\b/i;

export function classifyRunKind(path: string, name: string): WorkflowRunKind {
  const blob = `${path} ${name}`;
  if (DEPLOY_HINTS.test(blob)) return "deploy";
  if (BUILD_HINTS.test(blob))  return "build";
  if (CHECK_HINTS.test(blob))  return "check";
  return "other";
}
