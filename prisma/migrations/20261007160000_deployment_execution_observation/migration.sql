CREATE TABLE "DeploymentExecution" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "repositoryFullName" TEXT NOT NULL,
    "workflowRunId" TEXT,
    "workflowUrl" TEXT,
    "source" TEXT NOT NULL,
    "triggeredByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "conclusion" TEXT,
    "rollbackStatus" TEXT NOT NULL DEFAULT 'not_started',
    "lastObservedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentExecution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeploymentExecution_organizationId_createdAt_idx"
    ON "DeploymentExecution"("organizationId", "createdAt");

CREATE INDEX "DeploymentExecution_organizationId_environmentId_createdAt_idx"
    ON "DeploymentExecution"("organizationId", "environmentId", "createdAt");

CREATE UNIQUE INDEX "DeploymentExecution_organizationId_workflowRunId_key"
    ON "DeploymentExecution"("organizationId", "workflowRunId");
