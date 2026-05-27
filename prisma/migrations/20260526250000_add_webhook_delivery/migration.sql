-- Phase 497 — InboundWebhookDelivery scaffold.
--
-- Distinct from the outbound WebhookDelivery model (Phase 395) which
-- tracks attempts the platform makes against integrator endpoints.
-- This table records payloads *received* from upstream providers.
-- Unique on (provider, deliveryId) — retries collapse to one row.

-- CreateTable
CREATE TABLE "InboundWebhookDelivery" (
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

    CONSTRAINT "InboundWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboundWebhookDelivery_provider_deliveryId_key" ON "InboundWebhookDelivery"("provider", "deliveryId");

-- CreateIndex
CREATE INDEX "InboundWebhookDelivery_organizationId_receivedAt_idx" ON "InboundWebhookDelivery"("organizationId", "receivedAt");

-- CreateIndex
CREATE INDEX "InboundWebhookDelivery_organizationId_provider_eventKind_idx" ON "InboundWebhookDelivery"("organizationId", "provider", "eventKind");
