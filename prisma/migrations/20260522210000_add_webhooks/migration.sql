-- Phase 395: outbound webhook delivery — endpoints + per-attempt log.

CREATE TABLE "WebhookEndpoint" (
    "id"                    TEXT NOT NULL,
    "organizationId"        TEXT NOT NULL,
    "name"                  TEXT NOT NULL,
    "url"                   TEXT NOT NULL,
    "secret"                TEXT NOT NULL,
    "subscribedEvents"      JSONB NOT NULL,
    "consecutiveFailures"   INTEGER NOT NULL DEFAULT 0,
    "autoDisableThreshold"  INTEGER NOT NULL DEFAULT 50,
    "createdBy"             TEXT NOT NULL,
    "revokedAt"             TIMESTAMP(3),
    "revokedReason"         TEXT,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebhookEndpoint_organizationId_createdAt_idx"
    ON "WebhookEndpoint"("organizationId", "createdAt");
CREATE INDEX "WebhookEndpoint_revokedAt_idx" ON "WebhookEndpoint"("revokedAt");

CREATE TABLE "WebhookDelivery" (
    "id"                  TEXT NOT NULL,
    "endpointId"          TEXT NOT NULL,
    "organizationId"      TEXT NOT NULL,
    "eventId"             TEXT NOT NULL,
    "eventKind"           TEXT NOT NULL,
    "attemptNumber"       INTEGER NOT NULL,
    "status"              TEXT NOT NULL DEFAULT 'queued',
    "outcomeKind"         TEXT,
    "httpStatus"          INTEGER,
    "responseBodySnippet" TEXT,
    "errorMessage"        TEXT,
    "attemptedAt"         TIMESTAMP(3),
    "respondedAt"         TIMESTAMP(3),
    "nextAttemptAt"       TIMESTAMP(3),
    "payload"             JSONB NOT NULL,
    "requestHeaders"      JSONB,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebhookDelivery_endpointId_attemptNumber_idx"
    ON "WebhookDelivery"("endpointId", "attemptNumber");
CREATE INDEX "WebhookDelivery_organizationId_createdAt_idx"
    ON "WebhookDelivery"("organizationId", "createdAt");
CREATE INDEX "WebhookDelivery_status_nextAttemptAt_idx"
    ON "WebhookDelivery"("status", "nextAttemptAt");
CREATE INDEX "WebhookDelivery_eventId_idx" ON "WebhookDelivery"("eventId");

ALTER TABLE "WebhookDelivery"
    ADD CONSTRAINT "WebhookDelivery_endpointId_fkey"
        FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
