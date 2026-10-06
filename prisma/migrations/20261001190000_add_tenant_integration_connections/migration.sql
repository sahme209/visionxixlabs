-- Tenant-scoped OAuth integrations for Slack and Microsoft Teams.
--
-- OAuth tokens are stored only as context-bound AES-GCM ciphertext in
-- TenantIntegrationConnection. Authorization states are represented solely
-- by a digest, so a database read cannot replay an in-flight browser flow.

CREATE TABLE "TenantIntegrationConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "encryptedCredential" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "scopesJson" JSONB,
    "consentedByUserId" TEXT,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastValidatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantIntegrationConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantIntegrationConnection_organizationId_provider_key"
  ON "TenantIntegrationConnection"("organizationId", "provider");
CREATE INDEX "TenantIntegrationConnection_organizationId_status_idx"
  ON "TenantIntegrationConnection"("organizationId", "status");

CREATE TABLE "TenantIntegrationAuthorizationAttempt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "stateDigest" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "encryptedPkceVerifier" TEXT,
    "initiatedByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantIntegrationAuthorizationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantIntegrationAuthorizationAttempt_stateDigest_key"
  ON "TenantIntegrationAuthorizationAttempt"("stateDigest");
CREATE INDEX "TenantIntegrationAuthorizationAttempt_organizationId_provider_expiresAt_idx"
  ON "TenantIntegrationAuthorizationAttempt"("organizationId", "provider", "expiresAt");
CREATE INDEX "TenantIntegrationAuthorizationAttempt_expiresAt_idx"
  ON "TenantIntegrationAuthorizationAttempt"("expiresAt");
