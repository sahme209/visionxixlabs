-- Review-only additive proposal. Separate explicit production approval required.
-- No workflow, quota, credentials or existing application records are changed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE "EcsReleaseReviewPacket" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "organizationId" TEXT NOT NULL,
 "environmentId" TEXT NOT NULL,
 "operationId" TEXT NOT NULL,
 "manifestJson" JSONB NOT NULL CHECK (jsonb_typeof("manifestJson") = 'object'),
 "manifestDigest" TEXT NOT NULL CHECK ("manifestDigest" ~ '^sha256:[a-f0-9]{64}$'),
 "imageSetDigest" TEXT NOT NULL CHECK ("imageSetDigest" ~ '^sha256:[a-f0-9]{64}$'),
 "healthPolicyDigest" TEXT NOT NULL CHECK ("healthPolicyDigest" ~ '^sha256:[a-f0-9]{64}$'),
 "verifiedEvidenceJson" JSONB NOT NULL CHECK (jsonb_typeof("verifiedEvidenceJson") = 'object'),
 "evidenceDigest" TEXT NOT NULL CHECK ("evidenceDigest" ~ '^sha256:[a-f0-9]{64}$'),
 "policyDigest" TEXT NOT NULL CHECK ("policyDigest" ~ '^sha256:[a-f0-9]{64}$'),
 "createdByUserId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 CHECK ("expiresAt" > "createdAt"),
 UNIQUE ("organizationId", "operationId"), UNIQUE ("id", "organizationId")
);
CREATE INDEX "EcsReleaseReviewPacket_scope_expiry_idx" ON "EcsReleaseReviewPacket" ("organizationId", "environmentId", "expiresAt");
CREATE TABLE "EcsReleaseReviewDecision" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "packetId" TEXT NOT NULL,
 "organizationId" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "revision" INTEGER NOT NULL CHECK ("revision" >= 1),
 "decision" TEXT NOT NULL CHECK ("decision" IN ('approved', 'rejected', 'revoked')),
 "manifestDigest" TEXT NOT NULL CHECK ("manifestDigest" ~ '^sha256:[a-f0-9]{64}$'),
 "policyDigest" TEXT NOT NULL CHECK ("policyDigest" ~ '^sha256:[a-f0-9]{64}$'),
 "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 CHECK ("expiresAt" > "decidedAt"),
 FOREIGN KEY ("packetId", "organizationId") REFERENCES "EcsReleaseReviewPacket" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
 UNIQUE ("packetId", "userId", "revision")
);
CREATE INDEX "EcsReleaseReviewDecision_scope_revision_idx" ON "EcsReleaseReviewDecision" ("organizationId", "packetId", "userId", "revision" DESC);
CREATE TABLE "EcsReleaseReviewCheckpoint" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "packetId" TEXT NOT NULL,
 "organizationId" TEXT NOT NULL,
 "manifestDigest" TEXT NOT NULL CHECK ("manifestDigest" ~ '^sha256:[a-f0-9]{64}$'),
 "policyDigest" TEXT NOT NULL CHECK ("policyDigest" ~ '^sha256:[a-f0-9]{64}$'),
 "decisionSetDigest" TEXT NOT NULL CHECK ("decisionSetDigest" ~ '^sha256:[a-f0-9]{64}$'),
 "decisionIds" JSONB NOT NULL CHECK (jsonb_typeof("decisionIds") = 'array'),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 CHECK ("expiresAt" > "createdAt"),
 FOREIGN KEY ("packetId", "organizationId") REFERENCES "EcsReleaseReviewPacket" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
 UNIQUE ("packetId", "decisionSetDigest")
);
CREATE INDEX "EcsReleaseReviewCheckpoint_organizationId_packetId_idx" ON "EcsReleaseReviewCheckpoint" ("organizationId", "packetId");
COMMIT;
