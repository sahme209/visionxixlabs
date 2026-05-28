-- Phase 517 — Slack notification config + delivery log.

-- CreateTable
CREATE TABLE "SlackNotificationConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "enabledSignalKindsJson" JSONB,
    "defaultChannel" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackNotificationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlackNotificationConfig_organizationId_key" ON "SlackNotificationConfig"("organizationId");

-- CreateTable
CREATE TABLE "SlackNotificationLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "signalKind" TEXT NOT NULL,
    "subjectKind" TEXT,
    "subjectId" TEXT,
    "title" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'sent',
    "httpStatus" INTEGER,
    "errorMessage" TEXT,
    "payloadJson" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlackNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SlackNotificationLog_organizationId_generatedAt_idx" ON "SlackNotificationLog"("organizationId", "generatedAt");

-- CreateIndex
CREATE INDEX "SlackNotificationLog_organizationId_signalKind_idx" ON "SlackNotificationLog"("organizationId", "signalKind");

-- CreateIndex
CREATE INDEX "SlackNotificationLog_organizationId_outcome_idx" ON "SlackNotificationLog"("organizationId", "outcome");
