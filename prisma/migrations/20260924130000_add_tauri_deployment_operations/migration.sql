CREATE TABLE "TauriDeploymentRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "correlationId" TEXT NOT NULL,
  "intakeJson" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "submittedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TauriDeploymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TauriPlaybook" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "deploymentRequestId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'submitted',
  "playbookJson" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TauriPlaybook_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TauriAuditEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "deploymentRequestId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "previousValueJson" JSONB,
  "newValueJson" JSONB,
  "source" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "evidenceLink" TEXT,
  "timeZone" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TauriAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TauriDeploymentRequest_organizationId_correlationId_key"
  ON "TauriDeploymentRequest"("organizationId", "correlationId");
CREATE INDEX "TauriDeploymentRequest_organizationId_status_createdAt_idx"
  ON "TauriDeploymentRequest"("organizationId", "status", "createdAt");
CREATE UNIQUE INDEX "TauriPlaybook_deploymentRequestId_version_key"
  ON "TauriPlaybook"("deploymentRequestId", "version");
CREATE INDEX "TauriPlaybook_organizationId_status_createdAt_idx"
  ON "TauriPlaybook"("organizationId", "status", "createdAt");
CREATE INDEX "TauriAuditEvent_organizationId_deploymentRequestId_occurredAt_idx"
  ON "TauriAuditEvent"("organizationId", "deploymentRequestId", "occurredAt");
CREATE INDEX "TauriAuditEvent_organizationId_correlationId_idx"
  ON "TauriAuditEvent"("organizationId", "correlationId");

ALTER TABLE "TauriPlaybook"
  ADD CONSTRAINT "TauriPlaybook_deploymentRequestId_fkey"
  FOREIGN KEY ("deploymentRequestId") REFERENCES "TauriDeploymentRequest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TauriAuditEvent"
  ADD CONSTRAINT "TauriAuditEvent_deploymentRequestId_fkey"
  FOREIGN KEY ("deploymentRequestId") REFERENCES "TauriDeploymentRequest"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
