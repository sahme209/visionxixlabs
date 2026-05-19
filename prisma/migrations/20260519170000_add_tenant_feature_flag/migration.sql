-- CreateTable
CREATE TABLE "TenantFeatureFlag" (
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "rationale" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantFeatureFlag_pkey" PRIMARY KEY ("organizationId","key")
);

-- CreateIndex
CREATE INDEX "TenantFeatureFlag_organizationId_updatedAt_idx" ON "TenantFeatureFlag"("organizationId", "updatedAt");
