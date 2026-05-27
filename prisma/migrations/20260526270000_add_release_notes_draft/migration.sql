-- Phase 500 — ReleaseNotesDraft scaffold.
--
-- One row per Release (uniq on releaseId). Closed-union status:
-- draft | reviewed | published. Bullets persisted as JSON array.

-- CreateTable
CREATE TABLE "ReleaseNotesDraft" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "bulletsJson" JSONB NOT NULL,
    "headline" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseNotesDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseNotesDraft_releaseId_key" ON "ReleaseNotesDraft"("releaseId");

-- CreateIndex
CREATE INDEX "ReleaseNotesDraft_organizationId_status_idx" ON "ReleaseNotesDraft"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ReleaseNotesDraft_organizationId_releaseId_idx" ON "ReleaseNotesDraft"("organizationId", "releaseId");
