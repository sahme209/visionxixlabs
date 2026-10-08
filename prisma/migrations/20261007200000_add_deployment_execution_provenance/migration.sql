ALTER TABLE "DeploymentExecution"
    ADD COLUMN "sourceRef" TEXT,
    ADD COLUMN "sourceKind" TEXT,
    ADD COLUMN "sourceCommitSha" TEXT,
    ADD COLUMN "branchPolicyId" TEXT,
    ADD COLUMN "pullRequestUrl" TEXT;
