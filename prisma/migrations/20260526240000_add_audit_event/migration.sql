-- Phase 496 — AuditEvent scaffold.
--
-- Append-only record of every state-changing ReleaseOps action.
-- Future phases wire individual responders to insert here.

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectKind" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'ok',
    "summary" TEXT NOT NULL,
    "detailJson" JSONB,
    "actorUserId" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_subjectKind_subjectId_idx" ON "AuditEvent"("organizationId", "subjectKind", "subjectId");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_kind_idx" ON "AuditEvent"("organizationId", "kind");
