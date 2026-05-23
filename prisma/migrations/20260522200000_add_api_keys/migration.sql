-- Phase 394: machine-to-machine API keys for the v1 surface.
-- Plaintext is shown ONCE at mint time; only the SHA-256 hash is persisted.
-- The `prefix` column (first 14 chars of plaintext, e.g. "vxlk_live_AB7K")
-- is indexed for fast lookup before constant-time hash comparison.

CREATE TABLE "ApiKey" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "prefix"         TEXT NOT NULL,
    "keyHash"        TEXT NOT NULL,
    "env"            TEXT NOT NULL,
    "scopes"         JSONB NOT NULL,
    "createdBy"      TEXT NOT NULL,
    "lastUsedAt"     TIMESTAMP(3),
    "lastUsedIp"     TEXT,
    "useCount"       INTEGER NOT NULL DEFAULT 0,
    "expiresAt"      TIMESTAMP(3),
    "revokedAt"      TIMESTAMP(3),
    "revokedReason"  TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_prefix_idx" ON "ApiKey"("prefix");
CREATE INDEX "ApiKey_organizationId_createdAt_idx" ON "ApiKey"("organizationId", "createdAt");
CREATE INDEX "ApiKey_revokedAt_idx" ON "ApiKey"("revokedAt");
