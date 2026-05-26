/**
 * Phase 451 — Git / CI-CD discovery persistence.
 *
 * Wraps the PullRequestRecord / ReleaseTagRecord / WorkflowRunRecord
 * Prisma models with the DI-client pattern Phase 414 / 427 / 442 use.
 * The adapter layer (GitHub in Phase 452, GitLab in 453, ADO in 454)
 * upserts via these functions; the branch-validation kernel + release
 * detail UI read from them.
 *
 * No I/O at module load — tests pass an in-memory stub.
 */

/* ──────────────────────────────────────────────────────────────────
   Closed-union types — match the schema string columns.
   ────────────────────────────────────────────────────────────── */

export const ALL_PR_STATES = ["open", "merged", "closed"] as const;
export type PrState = (typeof ALL_PR_STATES)[number];
export function isKnownPrState(s: string): s is PrState {
  return (ALL_PR_STATES as readonly string[]).includes(s);
}

export const ALL_CI_STATUSES = ["pending", "passing", "failing", "not_run"] as const;
export type CiStatus = (typeof ALL_CI_STATUSES)[number];
export function isKnownCiStatus(s: string): s is CiStatus {
  return (ALL_CI_STATUSES as readonly string[]).includes(s);
}

export const ALL_WORKFLOW_RUN_STATUSES = ["queued", "in_progress", "completed"] as const;
export type WorkflowRunStatus = (typeof ALL_WORKFLOW_RUN_STATUSES)[number];

export const ALL_WORKFLOW_RUN_CONCLUSIONS = ["success", "failure", "cancelled", "skipped", "neutral"] as const;
export type WorkflowRunConclusion = (typeof ALL_WORKFLOW_RUN_CONCLUSIONS)[number];

export const ALL_WORKFLOW_RUN_KINDS = ["build", "deploy", "check", "other"] as const;
export type WorkflowRunKind = (typeof ALL_WORKFLOW_RUN_KINDS)[number];

/* ──────────────────────────────────────────────────────────────────
   Row types — narrow projection.
   ────────────────────────────────────────────────────────────── */

export interface PullRequestRecordRow {
  id: string;
  organizationId: string;
  repositoryId: string;
  number: number;
  title: string;
  state: PrState;
  sourceBranch: string;
  targetBranch: string;
  commitShaHead: string;
  mergedAt: Date | null;
  mergedByUserId: string | null;
  linkedStories: string[];
  linkedTickets: string[];
  approvalsRequiredCount: number;
  approvalsObservedCount: number;
  codeownersApproved: boolean;
  ciStatus: CiStatus;
  webUrl: string | null;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReleaseTagRecordRow {
  id: string;
  organizationId: string;
  repositoryId: string;
  tagName: string;
  commitSha: string;
  createdAt: Date;
  taggerUserId: string | null;
  prListJson: ReadonlyArray<string> | null;
  commitListJson: ReadonlyArray<string> | null;
  diffAgainstPreviousProdJson: Record<string, unknown> | null;
  notes: string | null;
  lastSyncedAt: Date;
  updatedAt: Date;
}

export interface WorkflowRunRecordRow {
  id: string;
  organizationId: string;
  repositoryId: string;
  workflowName: string;
  externalRunId: string;
  status: WorkflowRunStatus;
  conclusion: WorkflowRunConclusion | null;
  runKind: WorkflowRunKind;
  commitSha: string | null;
  ref: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  webUrl: string | null;
  artifactsJson: Record<string, unknown> | null;
  lastSyncedAt: Date;
  createdAt: Date;
}

/* ──────────────────────────────────────────────────────────────────
   Structural repo contract.
   ────────────────────────────────────────────────────────────── */

interface PullRequestRecordDelegate {
  findUnique(args: { where: { repositoryId_number: { repositoryId: string; number: number } } }): Promise<PullRequestRecordRow | null>;
  findMany(args: {
    where: { organizationId: string; repositoryId?: string; state?: PrState; commitShaHead?: string };
    orderBy: { updatedAt: "desc" };
    take?: number;
  }): Promise<PullRequestRecordRow[]>;
  upsert(args: {
    where: { repositoryId_number: { repositoryId: string; number: number } };
    create: Omit<PullRequestRecordRow, "id" | "createdAt" | "updatedAt" | "lastSyncedAt"> & { lastSyncedAt?: Date };
    update: Partial<Omit<PullRequestRecordRow, "id" | "organizationId" | "repositoryId" | "number" | "createdAt">>;
  }): Promise<PullRequestRecordRow>;
}

interface ReleaseTagRecordDelegate {
  findUnique(args: { where: { repositoryId_tagName: { repositoryId: string; tagName: string } } }): Promise<ReleaseTagRecordRow | null>;
  findMany(args: {
    where: { organizationId: string; repositoryId?: string };
    orderBy: { createdAt: "desc" };
    take?: number;
  }): Promise<ReleaseTagRecordRow[]>;
  upsert(args: {
    where: { repositoryId_tagName: { repositoryId: string; tagName: string } };
    create: Omit<ReleaseTagRecordRow, "id" | "updatedAt" | "lastSyncedAt"> & { lastSyncedAt?: Date };
    update: Partial<Omit<ReleaseTagRecordRow, "id" | "organizationId" | "repositoryId" | "tagName" | "createdAt">>;
  }): Promise<ReleaseTagRecordRow>;
}

interface WorkflowRunRecordDelegate {
  findUnique(args: { where: { repositoryId_externalRunId: { repositoryId: string; externalRunId: string } } }): Promise<WorkflowRunRecordRow | null>;
  findMany(args: {
    where: { organizationId: string; repositoryId?: string; status?: WorkflowRunStatus; commitSha?: string; runKind?: WorkflowRunKind };
    orderBy: { startedAt: "desc" };
    take?: number;
  }): Promise<WorkflowRunRecordRow[]>;
  upsert(args: {
    where: { repositoryId_externalRunId: { repositoryId: string; externalRunId: string } };
    create: Omit<WorkflowRunRecordRow, "id" | "createdAt" | "lastSyncedAt"> & { lastSyncedAt?: Date };
    update: Partial<Omit<WorkflowRunRecordRow, "id" | "organizationId" | "repositoryId" | "externalRunId" | "createdAt">>;
  }): Promise<WorkflowRunRecordRow>;
}

export interface GitDiscoveryRepo {
  pullRequestRecord: PullRequestRecordDelegate;
  releaseTagRecord: ReleaseTagRecordDelegate;
  workflowRunRecord: WorkflowRunRecordDelegate;
  $transaction<T>(fn: (tx: GitDiscoveryRepo) => Promise<T>): Promise<T>;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface — upsert helpers.
   ────────────────────────────────────────────────────────────── */

export interface UpsertPrInput
  extends Omit<PullRequestRecordRow, "id" | "createdAt" | "updatedAt" | "lastSyncedAt"> {
  /** Override observation time. Defaults to new Date(). */
  observedAt?: Date;
}

export async function upsertPullRequestRecord(
  repo: GitDiscoveryRepo,
  input: UpsertPrInput,
): Promise<PullRequestRecordRow> {
  if (!isKnownPrState(input.state)) {
    throw new Error(`Unknown PR state: ${input.state}`);
  }
  if (!isKnownCiStatus(input.ciStatus)) {
    throw new Error(`Unknown CI status: ${input.ciStatus}`);
  }
  const lastSyncedAt = input.observedAt ?? new Date();
  return repo.pullRequestRecord.upsert({
    where: { repositoryId_number: { repositoryId: input.repositoryId, number: input.number } },
    create: { ...input, lastSyncedAt },
    update: {
      title: input.title,
      state: input.state,
      sourceBranch: input.sourceBranch,
      targetBranch: input.targetBranch,
      commitShaHead: input.commitShaHead,
      mergedAt: input.mergedAt,
      mergedByUserId: input.mergedByUserId,
      linkedStories: input.linkedStories,
      linkedTickets: input.linkedTickets,
      approvalsRequiredCount: input.approvalsRequiredCount,
      approvalsObservedCount: input.approvalsObservedCount,
      codeownersApproved: input.codeownersApproved,
      ciStatus: input.ciStatus,
      webUrl: input.webUrl,
      lastSyncedAt,
    },
  });
}

export interface UpsertReleaseTagInput
  extends Omit<ReleaseTagRecordRow, "id" | "updatedAt" | "lastSyncedAt"> {
  observedAt?: Date;
}

export async function upsertReleaseTagRecord(
  repo: GitDiscoveryRepo,
  input: UpsertReleaseTagInput,
): Promise<ReleaseTagRecordRow> {
  const lastSyncedAt = input.observedAt ?? new Date();
  return repo.releaseTagRecord.upsert({
    where: { repositoryId_tagName: { repositoryId: input.repositoryId, tagName: input.tagName } },
    create: { ...input, lastSyncedAt },
    update: {
      commitSha: input.commitSha,
      taggerUserId: input.taggerUserId,
      prListJson: input.prListJson,
      commitListJson: input.commitListJson,
      diffAgainstPreviousProdJson: input.diffAgainstPreviousProdJson,
      notes: input.notes,
      lastSyncedAt,
    },
  });
}

export interface UpsertWorkflowRunInput
  extends Omit<WorkflowRunRecordRow, "id" | "createdAt" | "lastSyncedAt"> {
  observedAt?: Date;
}

export async function upsertWorkflowRunRecord(
  repo: GitDiscoveryRepo,
  input: UpsertWorkflowRunInput,
): Promise<WorkflowRunRecordRow> {
  const lastSyncedAt = input.observedAt ?? new Date();
  return repo.workflowRunRecord.upsert({
    where: { repositoryId_externalRunId: { repositoryId: input.repositoryId, externalRunId: input.externalRunId } },
    create: { ...input, lastSyncedAt },
    update: {
      workflowName: input.workflowName,
      status: input.status,
      conclusion: input.conclusion,
      runKind: input.runKind,
      commitSha: input.commitSha,
      ref: input.ref,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      webUrl: input.webUrl,
      artifactsJson: input.artifactsJson,
      lastSyncedAt,
    },
  });
}

/* ──────────────────────────────────────────────────────────────────
   Read helpers — the routes / kernels consume these.
   ────────────────────────────────────────────────────────────── */

export async function listPullRequestsByCommit(
  repo: GitDiscoveryRepo,
  args: { organizationId: string; commitSha: string },
): Promise<PullRequestRecordRow[]> {
  return repo.pullRequestRecord.findMany({
    where: { organizationId: args.organizationId, commitShaHead: args.commitSha },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listReleaseTagsForRepo(
  repo: GitDiscoveryRepo,
  args: { organizationId: string; repositoryId: string; take?: number },
): Promise<ReleaseTagRecordRow[]> {
  return repo.releaseTagRecord.findMany({
    where: { organizationId: args.organizationId, repositoryId: args.repositoryId },
    orderBy: { createdAt: "desc" },
    take: args.take ?? 25,
  });
}

export async function listWorkflowRunsForCommit(
  repo: GitDiscoveryRepo,
  args: { organizationId: string; commitSha: string; take?: number },
): Promise<WorkflowRunRecordRow[]> {
  return repo.workflowRunRecord.findMany({
    where: { organizationId: args.organizationId, commitSha: args.commitSha },
    orderBy: { startedAt: "desc" },
    take: args.take ?? 25,
  });
}

/* ──────────────────────────────────────────────────────────────────
   Pure helpers — release-tag diff projection.
   ────────────────────────────────────────────────────────────── */

export interface ReleaseTagDiffSummary {
  fromTag: string;
  toTag: string;
  prCount: number;
  commitCount: number;
  /** PRs present in to but missing from from. */
  newlyIncludedPrIds: string[];
  /** PRs present in from but missing from to. (Rare; e.g. cherry-pick drop.) */
  droppedPrIds: string[];
}

export function diffReleaseTags(
  from: Pick<ReleaseTagRecordRow, "tagName" | "prListJson">,
  to: Pick<ReleaseTagRecordRow, "tagName" | "prListJson" | "commitListJson">,
): ReleaseTagDiffSummary {
  const fromPrs = new Set(from.prListJson ?? []);
  const toPrs = new Set(to.prListJson ?? []);
  const newlyIncludedPrIds: string[] = [];
  const droppedPrIds: string[] = [];
  for (const id of toPrs) if (!fromPrs.has(id)) newlyIncludedPrIds.push(id);
  for (const id of fromPrs) if (!toPrs.has(id)) droppedPrIds.push(id);
  return {
    fromTag: from.tagName,
    toTag: to.tagName,
    prCount: toPrs.size,
    commitCount: (to.commitListJson ?? []).length,
    newlyIncludedPrIds,
    droppedPrIds,
  };
}
