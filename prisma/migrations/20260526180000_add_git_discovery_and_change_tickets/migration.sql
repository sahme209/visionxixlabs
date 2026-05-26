-- Phase 466 — Git-discovery + change-ticket persistence.
--
-- Adds the 5 tables Phases 451 / 457 / 463 reference but defer
-- migrating until now:
--   - PullRequestRecord, ReleaseTagRecord, WorkflowRunRecord (451)
--   - CherryPickException (457)
--   - ChangeTicket (463)
--
-- Closed-union string columns (state, status, runKind, provider,
-- ticketType, priority) are validated application-side, not via
-- enums, so future status additions don't require a migration.

-- CreateTable
CREATE TABLE "PullRequestRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "sourceBranch" TEXT NOT NULL,
    "targetBranch" TEXT NOT NULL,
    "commitShaHead" TEXT NOT NULL,
    "mergedAt" TIMESTAMP(3),
    "mergedByUserId" TEXT,
    "linkedStories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedTickets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approvalsRequiredCount" INTEGER NOT NULL DEFAULT 0,
    "approvalsObservedCount" INTEGER NOT NULL DEFAULT 0,
    "codeownersApproved" BOOLEAN NOT NULL DEFAULT false,
    "ciStatus" TEXT NOT NULL DEFAULT 'not_run',
    "webUrl" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PullRequestRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseTagRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "tagName" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taggerUserId" TEXT,
    "prListJson" JSONB,
    "commitListJson" JSONB,
    "diffAgainstPreviousProdJson" JSONB,
    "notes" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseTagRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRunRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "workflowName" TEXT NOT NULL,
    "externalRunId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "conclusion" TEXT,
    "runKind" TEXT NOT NULL DEFAULT 'other',
    "commitSha" TEXT,
    "ref" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "webUrl" TEXT,
    "artifactsJson" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowRunRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CherryPickException" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "rationale" TEXT NOT NULL,
    "approvedPrIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludedPrIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hasFinalCommitValidation" BOOLEAN NOT NULL DEFAULT false,
    "requestedByUserId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CherryPickException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeTicket" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "ticketType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "assigneeUserId" TEXT,
    "reporterUserId" TEXT,
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "webUrl" TEXT,
    "linkedPrRecordIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedReleaseIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeTicket_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE INDEX "PullRequestRecord_organizationId_idx" ON "PullRequestRecord"("organizationId");

-- CreateIndex
CREATE INDEX "PullRequestRecord_state_idx" ON "PullRequestRecord"("state");

-- CreateIndex
CREATE INDEX "PullRequestRecord_commitShaHead_idx" ON "PullRequestRecord"("commitShaHead");

-- CreateIndex
CREATE UNIQUE INDEX "PullRequestRecord_repositoryId_number_key" ON "PullRequestRecord"("repositoryId", "number");

-- CreateIndex
CREATE INDEX "ReleaseTagRecord_organizationId_idx" ON "ReleaseTagRecord"("organizationId");

-- CreateIndex
CREATE INDEX "ReleaseTagRecord_commitSha_idx" ON "ReleaseTagRecord"("commitSha");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseTagRecord_repositoryId_tagName_key" ON "ReleaseTagRecord"("repositoryId", "tagName");

-- CreateIndex
CREATE INDEX "WorkflowRunRecord_organizationId_idx" ON "WorkflowRunRecord"("organizationId");

-- CreateIndex
CREATE INDEX "WorkflowRunRecord_status_idx" ON "WorkflowRunRecord"("status");

-- CreateIndex
CREATE INDEX "WorkflowRunRecord_commitSha_idx" ON "WorkflowRunRecord"("commitSha");

-- CreateIndex
CREATE INDEX "WorkflowRunRecord_runKind_idx" ON "WorkflowRunRecord"("runKind");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRunRecord_repositoryId_externalRunId_key" ON "WorkflowRunRecord"("repositoryId", "externalRunId");

-- CreateIndex
CREATE INDEX "CherryPickException_organizationId_status_idx" ON "CherryPickException"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CherryPickException_releaseId_idx" ON "CherryPickException"("releaseId");

-- CreateIndex
CREATE INDEX "CherryPickException_repositoryId_idx" ON "CherryPickException"("repositoryId");

-- CreateIndex
CREATE INDEX "ChangeTicket_organizationId_status_idx" ON "ChangeTicket"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ChangeTicket_organizationId_provider_idx" ON "ChangeTicket"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "ChangeTicket_assigneeUserId_idx" ON "ChangeTicket"("assigneeUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeTicket_organizationId_provider_externalKey_key" ON "ChangeTicket"("organizationId", "provider", "externalKey");

