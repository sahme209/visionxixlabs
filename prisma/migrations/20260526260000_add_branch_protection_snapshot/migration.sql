-- Phase 499 — BranchProtectionSnapshot scaffold.
--
-- One row per (repositoryId, branchName). The readiness evaluator's
-- branchGovernance signal reads from here.

-- CreateTable
CREATE TABLE "BranchProtectionSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "requiresPullRequest" BOOLEAN NOT NULL,
    "requiredReviewCount" INTEGER NOT NULL DEFAULT 0,
    "dismissStaleReviews" BOOLEAN NOT NULL DEFAULT false,
    "requireCodeOwnerReviews" BOOLEAN NOT NULL DEFAULT false,
    "requiresStatusChecks" BOOLEAN NOT NULL DEFAULT false,
    "requiredStatusCheckContexts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiresSignedCommits" BOOLEAN NOT NULL DEFAULT false,
    "requiresLinearHistory" BOOLEAN NOT NULL DEFAULT false,
    "enforceAdmins" BOOLEAN NOT NULL DEFAULT false,
    "allowsForcePushes" BOOLEAN NOT NULL DEFAULT false,
    "allowsDeletions" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'github_api',
    "rawJson" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchProtectionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BranchProtectionSnapshot_repositoryId_branchName_key" ON "BranchProtectionSnapshot"("repositoryId", "branchName");

-- CreateIndex
CREATE INDEX "BranchProtectionSnapshot_organizationId_repositoryId_idx" ON "BranchProtectionSnapshot"("organizationId", "repositoryId");

-- CreateIndex
CREATE INDEX "BranchProtectionSnapshot_organizationId_strength_idx" ON "BranchProtectionSnapshot"("organizationId", "strength");
