-- AlterTable
ALTER TABLE "TenantIdentityProvider" ADD COLUMN     "encryptedClientSecret" TEXT,
ADD COLUMN     "oidcClientId" TEXT,
ADD COLUMN     "verifiedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "SsoLoginAttempt" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "encryptedSecrets" TEXT NOT NULL,
    "callbackUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "ticketHash" TEXT,
    "userId" TEXT,
    "ticketExpiresAt" TIMESTAMP(3),
    "ticketConsumedAt" TIMESTAMP(3),

    CONSTRAINT "SsoLoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SsoLoginAttempt_ticketHash_key" ON "SsoLoginAttempt"("ticketHash");

-- CreateIndex
CREATE INDEX "SsoLoginAttempt_expiresAt_idx" ON "SsoLoginAttempt"("expiresAt");

-- CreateIndex
CREATE INDEX "SsoLoginAttempt_providerId_idx" ON "SsoLoginAttempt"("providerId");

