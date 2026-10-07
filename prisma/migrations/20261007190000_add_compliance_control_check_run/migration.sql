-- Scheduled compliance control checks — see prisma/schema.prisma's
-- comment above ComplianceControlCheckRun.

-- CreateTable
CREATE TABLE "ComplianceControlCheckRun" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceControlCheckRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceControlCheckRun_controlId_checkedAt_idx" ON "ComplianceControlCheckRun"("controlId", "checkedAt");
