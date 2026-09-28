CREATE TABLE "DesktopPairingChallengeRecord" (
    "id" TEXT NOT NULL,
    "deviceFingerprint" TEXT NOT NULL,
    "deviceLabel" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "desktopVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedByUserId" TEXT,
    "approvedOrganizationId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    CONSTRAINT "DesktopPairingChallengeRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DesktopPairingChallengeRecord_expiresAt_idx" ON "DesktopPairingChallengeRecord"("expiresAt");
CREATE INDEX "DesktopPairingChallengeRecord_approvedByUserId_idx" ON "DesktopPairingChallengeRecord"("approvedByUserId");
CREATE INDEX "DesktopPairingChallengeRecord_sessionId_idx" ON "DesktopPairingChallengeRecord"("sessionId");
