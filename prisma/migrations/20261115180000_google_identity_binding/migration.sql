-- Additive Google identity binding; existing accounts are not backfilled.
-- Prisma supplies cuid IDs and updatedAt values. No identity/email backfill.
CREATE TABLE "OAuthIdentity" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "issuer" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthIdentity_google_only" CHECK ("provider" = 'google' AND "issuer" = 'https://accounts.google.com'),
  CONSTRAINT "OAuthIdentity_subject_length" CHECK (length("subject") BETWEEN 1 AND 255),
  CONSTRAINT "OAuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OAuthIdentity_provider_issuer_subject_key" ON "OAuthIdentity"("provider", "issuer", "subject");
-- One Google identity per User initially: replacement requires separate recovery.
CREATE UNIQUE INDEX "OAuthIdentity_userId_provider_issuer_key" ON "OAuthIdentity"("userId", "provider", "issuer");
CREATE TABLE "PendingGoogleIdentityLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "issuer" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "candidateUserId" TEXT,
  "candidateUpdatedAt" TIMESTAMP(3),
  "browserNonceHash" TEXT NOT NULL,
  "csrfHash" TEXT NOT NULL,
  "emailProofHash" TEXT,
  "emailProofExpiresAt" TIMESTAMP(3),
  "emailSentAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "callbackPath" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  CONSTRAINT "PendingGoogleIdentityLink_google_only" CHECK ("issuer" = 'https://accounts.google.com'),
  CONSTRAINT "PendingGoogleIdentityLink_subject_length" CHECK (length("subject") BETWEEN 1 AND 255),
  CONSTRAINT "PendingGoogleIdentityLink_attempts" CHECK ("attempts" BETWEEN 0 AND 5),
  CONSTRAINT "PendingGoogleIdentityLink_candidate" CHECK (("candidateUserId" IS NULL) = ("candidateUpdatedAt" IS NULL)),
  CONSTRAINT "PendingGoogleIdentityLink_proof" CHECK (("emailProofHash" IS NULL) = ("emailProofExpiresAt" IS NULL)),
  CONSTRAINT "PendingGoogleIdentityLink_proof_expiry" CHECK ("emailProofExpiresAt" IS NULL OR "emailProofExpiresAt" <= "expiresAt"),
  CONSTRAINT "PendingGoogleIdentityLink_expiry" CHECK ("expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + INTERVAL '15 minutes'),
  CONSTRAINT "PendingGoogleIdentityLink_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PendingGoogleIdentityLink_browserNonceHash_key" ON "PendingGoogleIdentityLink"("browserNonceHash");
CREATE UNIQUE INDEX "PendingGoogleIdentityLink_emailProofHash_key" ON "PendingGoogleIdentityLink"("emailProofHash");
CREATE INDEX "PendingGoogleIdentityLink_expiresAt_idx" ON "PendingGoogleIdentityLink"("expiresAt");
