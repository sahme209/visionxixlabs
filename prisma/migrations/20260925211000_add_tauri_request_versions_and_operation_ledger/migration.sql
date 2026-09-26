-- Immutable request revisions plus durable operation ledger.
CREATE TABLE "TauriDeploymentRequestVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deploymentRequestId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "intakeJson" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TauriDeploymentRequestVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TauriDeploymentRequestVersion_deploymentRequestId_version_key"
    ON "TauriDeploymentRequestVersion"("deploymentRequestId", "version");

CREATE INDEX "TauriDeploymentRequestVersion_organizationId_createdAt_idx"
    ON "TauriDeploymentRequestVersion"("organizationId", "createdAt");

ALTER TABLE "TauriDeploymentRequestVersion"
    ADD CONSTRAINT "TauriDeploymentRequestVersion_deploymentRequestId_fkey"
    FOREIGN KEY ("deploymentRequestId") REFERENCES "TauriDeploymentRequest"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Durable operation ledger for consequential desktop deployment actions.
CREATE TABLE "TauriDeploymentOperation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deploymentRequestId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "contextDigest" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "lastReconciledAt" TIMESTAMP(3),
    "externalReference" TEXT,
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TauriDeploymentOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TauriDeploymentOperation_organizationId_idempotencyKey_key"
    ON "TauriDeploymentOperation"("organizationId", "idempotencyKey");

CREATE INDEX "TauriDeploymentOperation_organizationId_deploymentRequestId_createdAt_idx"
    ON "TauriDeploymentOperation"("organizationId", "deploymentRequestId", "createdAt");

CREATE INDEX "TauriDeploymentOperation_organizationId_status_updatedAt_idx"
    ON "TauriDeploymentOperation"("organizationId", "status", "updatedAt");
