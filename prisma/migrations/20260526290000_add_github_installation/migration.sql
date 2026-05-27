-- Phase 502 — GitHubInstallation scaffold.
--
-- Captures the org's authorized GitHub App install via the
-- post-install callback. Idempotent on (organizationId,
-- githubInstallationId) — re-runs of the install flow overwrite.

-- CreateTable
CREATE TABLE "GitHubInstallation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "githubInstallationId" TEXT NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "repositorySelection" TEXT NOT NULL DEFAULT 'selected',
    "status" TEXT NOT NULL DEFAULT 'active',
    "sourceFlow" TEXT NOT NULL DEFAULT 'install',
    "installedByUserId" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspendedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "rawCallbackJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GitHubInstallation_organizationId_githubInstallationId_key" ON "GitHubInstallation"("organizationId", "githubInstallationId");

-- CreateIndex
CREATE INDEX "GitHubInstallation_organizationId_status_idx" ON "GitHubInstallation"("organizationId", "status");

-- CreateIndex
CREATE INDEX "GitHubInstallation_githubInstallationId_idx" ON "GitHubInstallation"("githubInstallationId");
