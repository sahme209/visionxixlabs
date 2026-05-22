-- Engineer-sourced approval snapshot — Phase 368.
--
-- Durable mirror of the in-memory ApprovalRequest the approval engine
-- mints for engineer-sourced actions. Survives Vercel deploys so the
-- /dashboard/workforce/approvals queue keeps history intact.

CREATE TABLE "EngineerApprovalSnapshot" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "approvalRequestId" TEXT NOT NULL,
  "engineerId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "attemptId" TEXT,
  "riskLevel" TEXT NOT NULL,
  "effectiveRule" TEXT NOT NULL,
  "requiredApprovers" INTEGER NOT NULL DEFAULT 0,
  "correlationId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "requestedBy" TEXT NOT NULL,
  "decidedByUserId" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EngineerApprovalSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EngineerApprovalSnapshot_approvalRequestId_key"
  ON "EngineerApprovalSnapshot"("approvalRequestId");

CREATE INDEX "EngineerApprovalSnapshot_organizationId_status_createdAt_idx"
  ON "EngineerApprovalSnapshot"("organizationId", "status", "createdAt");

CREATE INDEX "EngineerApprovalSnapshot_organizationId_engineerId_createdAt_idx"
  ON "EngineerApprovalSnapshot"("organizationId", "engineerId", "createdAt");

CREATE INDEX "EngineerApprovalSnapshot_correlationId_idx"
  ON "EngineerApprovalSnapshot"("correlationId");
