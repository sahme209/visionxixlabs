-- Phase 402: idempotency records for the v1 API surface.
-- Stripe-style: (organizationId, idempotencyKey, routePath) is unique
-- so the same key can be reused across DIFFERENT routes safely while
-- still deduping retries of the SAME route.

CREATE TABLE "IdempotencyRecord" (
    "id"               TEXT NOT NULL,
    "organizationId"   TEXT NOT NULL,
    "idempotencyKey"   TEXT NOT NULL,
    "routePath"        TEXT NOT NULL,
    "requestBodyHash"  TEXT NOT NULL,
    "status"           TEXT NOT NULL DEFAULT 'in_flight',
    "responseStatus"   INTEGER,
    "responseBody"     JSONB,
    "expiresAt"        TIMESTAMP(3) NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyRecord_org_key_route_idx"
    ON "IdempotencyRecord"("organizationId", "idempotencyKey", "routePath");
CREATE INDEX "IdempotencyRecord_expiresAt_idx"
    ON "IdempotencyRecord"("expiresAt");
