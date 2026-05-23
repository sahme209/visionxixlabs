-- Phase 404: ES256 asymmetric webhook signing.
-- Adds a platform-wide signing-key table + a per-endpoint signing-mode column.
-- Default for every existing endpoint remains "hmac"; ES256 is opt-in.

CREATE TABLE "WebhookSigningKey" (
    "id"            TEXT NOT NULL,
    "kid"           TEXT NOT NULL,
    "privateKeyPem" TEXT NOT NULL,
    "publicKeyPem"  TEXT NOT NULL,
    "publicJwk"     JSONB NOT NULL,
    "status"        TEXT NOT NULL DEFAULT 'active',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt"     TIMESTAMP(3),

    CONSTRAINT "WebhookSigningKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebhookSigningKey_kid_key" ON "WebhookSigningKey"("kid");
CREATE INDEX "WebhookSigningKey_status_idx" ON "WebhookSigningKey"("status");

ALTER TABLE "WebhookEndpoint"
    ADD COLUMN "signingMode" TEXT NOT NULL DEFAULT 'hmac';
