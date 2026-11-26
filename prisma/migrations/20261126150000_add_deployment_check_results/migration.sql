-- Additive only: results reported by customer CI for deployment checks.
CREATE TABLE "DeploymentCheckResult" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "checkKey" TEXT NOT NULL,
    "checkVersion" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER,
    "runUrl" TEXT,
    "environmentSlug" TEXT,
    "releaseRef" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeploymentCheckResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeploymentCheckResult_organizationId_idempotencyKey_key" ON "DeploymentCheckResult"("organizationId", "idempotencyKey");
CREATE INDEX "DeploymentCheckResult_organizationId_checkKey_reportedAt_idx" ON "DeploymentCheckResult"("organizationId", "checkKey", "reportedAt");
