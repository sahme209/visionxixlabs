-- Internal VisionXIXLabs growth automation (LinkedIn) — Phase 1
-- All tables below are admin-only. No tenant scoping. Backs the code in
-- lib/growth/ + app/admin/growth/* + app/api/admin/growth/*.

-- CreateTable
CREATE TABLE "GrowthCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "targetsJson" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrowthCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedInPostDraft" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "title" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cta" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT NOT NULL,
    "targetAudience" TEXT,
    "status" TEXT NOT NULL DEFAULT 'drafted',
    "confidence" DOUBLE PRECISION,
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "linkedinPostUrn" TEXT,
    "linkedinPostUrl" TEXT,
    "createdByAgent" TEXT NOT NULL DEFAULT 'marketingContentDrafter',
    "approvedByEmail" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "performanceNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedInPostDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedInAccountConnection" (
    "id" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "linkedinUrn" TEXT NOT NULL,
    "linkedinName" TEXT,
    "organizationUrn" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "scopes" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'connected',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedInAccountConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedInPostPublishRun" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "linkedinPostUrn" TEXT,
    "httpStatus" INTEGER,
    "errorDetail" TEXT,
    "diagnosticsJson" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "LinkedInPostPublishRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedInPostAnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reactions" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER,
    "manualEntry" BOOLEAN NOT NULL DEFAULT false,
    "enteredByEmail" TEXT,
    "notes" TEXT,

    CONSTRAINT "LinkedInPostAnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthAuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetKind" TEXT,
    "targetId" TEXT,
    "detail" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrowthAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GrowthCampaign_status_idx" ON "GrowthCampaign"("status");
CREATE INDEX "GrowthCampaign_startsAt_idx" ON "GrowthCampaign"("startsAt");

CREATE INDEX "LinkedInPostDraft_status_idx" ON "LinkedInPostDraft"("status");
CREATE INDEX "LinkedInPostDraft_scheduledFor_idx" ON "LinkedInPostDraft"("scheduledFor");
CREATE INDEX "LinkedInPostDraft_campaignId_idx" ON "LinkedInPostDraft"("campaignId");

CREATE UNIQUE INDEX "LinkedInAccountConnection_ownerEmail_key" ON "LinkedInAccountConnection"("ownerEmail");
CREATE INDEX "LinkedInAccountConnection_status_idx" ON "LinkedInAccountConnection"("status");

CREATE INDEX "LinkedInPostPublishRun_draftId_idx" ON "LinkedInPostPublishRun"("draftId");
CREATE INDEX "LinkedInPostPublishRun_outcome_idx" ON "LinkedInPostPublishRun"("outcome");
CREATE INDEX "LinkedInPostPublishRun_startedAt_idx" ON "LinkedInPostPublishRun"("startedAt");

CREATE INDEX "LinkedInPostAnalyticsSnapshot_draftId_collectedAt_idx" ON "LinkedInPostAnalyticsSnapshot"("draftId", "collectedAt");

CREATE INDEX "GrowthAuditLog_actor_idx" ON "GrowthAuditLog"("actor");
CREATE INDEX "GrowthAuditLog_action_idx" ON "GrowthAuditLog"("action");
CREATE INDEX "GrowthAuditLog_targetKind_targetId_idx" ON "GrowthAuditLog"("targetKind", "targetId");
CREATE INDEX "GrowthAuditLog_occurredAt_idx" ON "GrowthAuditLog"("occurredAt");

-- AddForeignKey
ALTER TABLE "LinkedInPostDraft" ADD CONSTRAINT "LinkedInPostDraft_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "GrowthCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LinkedInPostPublishRun" ADD CONSTRAINT "LinkedInPostPublishRun_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "LinkedInPostDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LinkedInPostAnalyticsSnapshot" ADD CONSTRAINT "LinkedInPostAnalyticsSnapshot_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "LinkedInPostDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
