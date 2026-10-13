ALTER TABLE "AgentActionProposal"
  ADD COLUMN "approvalExpiresAt" TIMESTAMP(3),
  ADD COLUMN "actionDigest" TEXT;

CREATE INDEX "AgentActionProposal_organizationId_status_approvalExpiresAt_idx"
  ON "AgentActionProposal"("organizationId", "status", "approvalExpiresAt");
