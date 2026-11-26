-- Additive only: deployment step checks attached to release stages.
CREATE TABLE "DeploymentCheck" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeploymentCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeploymentCheck_organizationId_key_key" ON "DeploymentCheck"("organizationId", "key");
CREATE INDEX "DeploymentCheck_organizationId_idx" ON "DeploymentCheck"("organizationId");
