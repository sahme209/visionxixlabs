-- Engineer-approval execution state — Phase 376.
--
-- The approvals queue staged actions and operators voted on them, but
-- "approved" was a terminal status with nothing downstream. This adds
-- the execution layer: each approved snapshot can transition to
-- "executed" (or "failed") via the executor registry. The atomic
-- compare-and-swap on executionStatus is the idempotency guard.

ALTER TABLE "EngineerApprovalSnapshot"
  ADD COLUMN "executionStatus" TEXT NOT NULL DEFAULT 'not_started';
ALTER TABLE "EngineerApprovalSnapshot"
  ADD COLUMN "executedAt" TIMESTAMP(3);
ALTER TABLE "EngineerApprovalSnapshot"
  ADD COLUMN "executedByUserId" TEXT;
ALTER TABLE "EngineerApprovalSnapshot"
  ADD COLUMN "executionResultSummary" TEXT;
ALTER TABLE "EngineerApprovalSnapshot"
  ADD COLUMN "executionResultDetail" JSONB;
ALTER TABLE "EngineerApprovalSnapshot"
  ADD COLUMN "executionError" TEXT;

CREATE INDEX "EngineerApprovalSnapshot_organizationId_executionStatus_idx"
  ON "EngineerApprovalSnapshot"("organizationId", "executionStatus");
