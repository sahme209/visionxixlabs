-- Persisted, tenant-scoped release-to-repository evidence binding.
-- Replaces the ad-hoc client-supplied ?repositoryId= query param
-- (/dashboard/releases/[id]/branch) as the permanent association for
-- GitHub evidence (PRs, checks, workflow runs) on a release. Set at most
-- once, at release-creation time (see releaseRepositoryBinding.ts) —
-- there is no update path, so existing releases remain NULL rather than
-- being backfilled with a guess.
ALTER TABLE "Release"
  ADD COLUMN "evidenceRepositoryId" TEXT,
  ADD COLUMN "evidenceRepositoryBoundAt" TIMESTAMP(3),
  ADD COLUMN "evidenceRepositoryBoundByUserId" TEXT;

CREATE INDEX "Release_evidenceRepositoryId_idx" ON "Release"("evidenceRepositoryId");
