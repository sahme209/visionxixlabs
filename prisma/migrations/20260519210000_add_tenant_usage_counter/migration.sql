-- CreateTable
CREATE TABLE "TenantUsageCounter" (
    "organizationId" TEXT NOT NULL,
    "capName" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantUsageCounter_pkey" PRIMARY KEY ("organizationId","capName","dateKey")
);

-- CreateIndex
CREATE INDEX "TenantUsageCounter_organizationId_dateKey_idx" ON "TenantUsageCounter"("organizationId", "dateKey");
