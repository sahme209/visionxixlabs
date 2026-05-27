-- Phase 497 — WebhookDelivery scaffold.
--
-- Idempotent log of every webhook delivery from GitHub / GitLab / ADO.
-- Unique on (provider, deliveryId) — retries collapse to one row.

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "eventKind" TEXT NOT NULL,
    "eventAction" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'accepted',
    "summary" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_provider_deliveryId_key" ON "WebhookDelivery"("provider", "deliveryId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_organizationId_receivedAt_idx" ON "WebhookDelivery"("organizationId", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_organizationId_provider_eventKind_idx" ON "WebhookDelivery"("organizationId", "provider", "eventKind");
