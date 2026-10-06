-- Enterprise identity — docs/ENTERPRISE_IDENTITY_DESIGN.md. Schema and
-- config management only; no OIDC/SAML client exists yet and no sign-in
-- path reads these tables. TenantIdentityProvider.status stays "pending"
-- until a real metadata exchange + test assertion round-trip ships in a
-- later phase.

-- CreateEnum
CREATE TYPE "IdentityProviderProtocol" AS ENUM ('oidc', 'saml');

-- CreateTable
CREATE TABLE "TenantIdentityProvider" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "protocol" "IdentityProviderProtocol" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "issuerOrEntityId" TEXT NOT NULL,
    "metadataDocument" TEXT NOT NULL,
    "managedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roleMappingJson" JSONB NOT NULL,
    "requireMfaClaim" BOOLEAN NOT NULL DEFAULT true,
    "lastTestAssertionAt" TIMESTAMP(3),
    "configuredByUserId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantIdentityProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScimProvisionedIdentity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "orgMembershipId" TEXT,
    "scimActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deprovisionedAt" TIMESTAMP(3),

    CONSTRAINT "ScimProvisionedIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantIdentityProvider_organizationId_protocol_key" ON "TenantIdentityProvider"("organizationId", "protocol");

-- CreateIndex
CREATE INDEX "TenantIdentityProvider_organizationId_status_idx" ON "TenantIdentityProvider"("organizationId", "status");

-- CreateIndex
CREATE INDEX "TenantIdentityProvider_issuerOrEntityId_idx" ON "TenantIdentityProvider"("issuerOrEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "ScimProvisionedIdentity_organizationId_externalId_key" ON "ScimProvisionedIdentity"("organizationId", "externalId");

-- CreateIndex
CREATE INDEX "ScimProvisionedIdentity_organizationId_email_idx" ON "ScimProvisionedIdentity"("organizationId", "email");
