CREATE TABLE "AirflowAutomation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dagId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "triggerMode" TEXT NOT NULL,
    "scheduleCron" TEXT,
    "requiredDagState" TEXT NOT NULL DEFAULT 'success',
    "dependencyDagIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "actionType" TEXT NOT NULL,
    "repositoryFullName" TEXT,
    "sourceRef" TEXT,
    "sourceKind" TEXT DEFAULT 'branch',
    "pullRequestBase" TEXT,
    "pullRequestTitle" TEXT,
    "environmentId" TEXT,
    "promotedFromExecutionId" TEXT,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "retryDelaySeconds" INTEGER NOT NULL DEFAULT 60,
    "notifyOnSuccess" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnFailure" BOOLEAN NOT NULL DEFAULT true,
    "lastEvaluatedAt" TIMESTAMP(3),
    "nextScheduledAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AirflowAutomation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AirflowAutomationExecution" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "sourceDagId" TEXT NOT NULL,
    "sourceDagRunId" TEXT NOT NULL,
    "sourceDagState" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_approval',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "resultJson" JSONB,
    "deploymentExecutionId" TEXT,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "rollbackStatus" TEXT NOT NULL DEFAULT 'not_required',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AirflowAutomationExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AirflowDagRunSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "dagId" TEXT NOT NULL,
    "dagRunId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "logicalDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AirflowDagRunSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AirflowAutomation_organizationId_name_key" ON "AirflowAutomation"("organizationId", "name");
CREATE INDEX "AirflowAutomation_organizationId_enabled_idx" ON "AirflowAutomation"("organizationId", "enabled");
CREATE INDEX "AirflowAutomation_connectionId_dagId_idx" ON "AirflowAutomation"("connectionId", "dagId");
CREATE INDEX "AirflowAutomation_nextScheduledAt_idx" ON "AirflowAutomation"("nextScheduledAt");
CREATE UNIQUE INDEX "AirflowAutomationExecution_automationId_sourceDagRunId_key" ON "AirflowAutomationExecution"("automationId", "sourceDagRunId");
CREATE INDEX "AirflowAutomationExecution_organizationId_status_createdAt_idx" ON "AirflowAutomationExecution"("organizationId", "status", "createdAt");
CREATE INDEX "AirflowAutomationExecution_status_nextRetryAt_idx" ON "AirflowAutomationExecution"("status", "nextRetryAt");
CREATE UNIQUE INDEX "AirflowDagRunSnapshot_connectionId_dagId_dagRunId_key" ON "AirflowDagRunSnapshot"("connectionId", "dagId", "dagRunId");
CREATE INDEX "AirflowDagRunSnapshot_organizationId_dagId_lastSeenAt_idx" ON "AirflowDagRunSnapshot"("organizationId", "dagId", "lastSeenAt");
CREATE INDEX "AirflowDagRunSnapshot_state_lastSeenAt_idx" ON "AirflowDagRunSnapshot"("state", "lastSeenAt");

ALTER TABLE "AirflowAutomationExecution"
ADD CONSTRAINT "AirflowAutomationExecution_automationId_fkey"
FOREIGN KEY ("automationId") REFERENCES "AirflowAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
