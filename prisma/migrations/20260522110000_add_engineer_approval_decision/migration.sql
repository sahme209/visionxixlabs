-- Engineer-sourced approval decisions — Phase 369.
--
-- One row per approver vote on an EngineerApprovalSnapshot. The
-- snapshot's status is recomputed from these rows by computeQuorumStatus().
-- Two-step approval (requiredApprovers >= 2) becomes safe because the
-- unique constraint on (snapshotId, approverUserId) blocks any single
-- user from rubber-stamping a critical action twice.

CREATE TABLE "EngineerApprovalDecision" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "approverUserId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "reason" TEXT,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EngineerApprovalDecision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EngineerApprovalDecision_snapshotId_approverUserId_key"
  ON "EngineerApprovalDecision"("snapshotId", "approverUserId");

CREATE INDEX "EngineerApprovalDecision_snapshotId_idx"
  ON "EngineerApprovalDecision"("snapshotId");

CREATE INDEX "EngineerApprovalDecision_organizationId_decidedAt_idx"
  ON "EngineerApprovalDecision"("organizationId", "decidedAt");

ALTER TABLE "EngineerApprovalDecision"
  ADD CONSTRAINT "EngineerApprovalDecision_snapshotId_fkey"
  FOREIGN KEY ("snapshotId") REFERENCES "EngineerApprovalSnapshot"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
