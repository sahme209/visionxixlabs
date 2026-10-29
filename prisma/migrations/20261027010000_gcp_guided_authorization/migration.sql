CREATE TABLE "GcpGuidedAuthorization" (
 "id" TEXT NOT NULL PRIMARY KEY, "organizationId" TEXT NOT NULL, "userId" TEXT NOT NULL, "sessionId" TEXT NOT NULL,
 "stateDigest" TEXT NOT NULL, "status" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 0,
 "encryptedVerifier" TEXT NOT NULL, "encryptedTokens" TEXT, "resourcesJson" JSONB,
 "operationExpiresAt" TIMESTAMP(3), "connectionId" TEXT, "connectionVersion" INTEGER, "expiresAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "GcpGuidedAuthorization_stateDigest_key" ON "GcpGuidedAuthorization"("stateDigest");
CREATE INDEX "GcpGuidedAuthorization_organizationId_userId_sessionId_expires_idx" ON "GcpGuidedAuthorization"("organizationId","userId","sessionId","expiresAt");
