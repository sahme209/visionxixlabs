-- Pre-promotion/pre-deploy test gate: a BranchEnvironmentPolicy can require
-- the resolved commit to already have a successful GitHub combined status
-- or check-run result (the repo's own CI/tests) before deploy is allowed.
-- See lib/releaseops/deploymentPolicyGuard.ts and
-- lib/connectors/github/githubWriteClient.ts's getCommitCiStatus.

-- AlterTable
ALTER TABLE "BranchEnvironmentPolicy"
    ADD COLUMN "requireTestsPassing" BOOLEAN NOT NULL DEFAULT false;
