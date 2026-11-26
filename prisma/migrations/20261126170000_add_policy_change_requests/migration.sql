-- Additive only: reviewed policy-file change requests (two-person apply).
CREATE TABLE "PolicyChangeRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentJson" JSONB NOT NULL,
    "baseDigest" TEXT NOT NULL,
    "diffJson" JSONB NOT NULL,
    "loosens" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "proposedByUserId" TEXT NOT NULL,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolicyChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PolicyChangeRequest_organizationId_status_createdAt_idx" ON "PolicyChangeRequest"("organizationId", "status", "createdAt");
