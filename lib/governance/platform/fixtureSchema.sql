-- Fresh owned isolated test database ONLY. Not a production migration/apply file.
CREATE TABLE "PlatformGovernanceAction" (
 id TEXT PRIMARY KEY, "planDigest" TEXT NOT NULL, "stateJson" JSONB NOT NULL,
 version INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "PlatformGovernanceAction_createdAt_id_idx" ON "PlatformGovernanceAction" ("createdAt", id);
CREATE TABLE "PlatformGovernanceEvent" (
 id TEXT PRIMARY KEY, "actionId" TEXT NOT NULL REFERENCES "PlatformGovernanceAction"(id) ON DELETE RESTRICT,
 sequence INTEGER NOT NULL, kind TEXT NOT NULL, "detailJson" JSONB NOT NULL,
 "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("actionId",sequence)
);
CREATE TABLE "PlatformGovernanceEffect" (
 "actionId" TEXT NOT NULL REFERENCES "PlatformGovernanceAction"(id) ON DELETE RESTRICT,
 index INTEGER NOT NULL, status TEXT NOT NULL, "publicationKey" TEXT UNIQUE, PRIMARY KEY ("actionId",index)
);
-- Manual owner-click notices are not executable platform action records.
CREATE TABLE "PlatformManualRelease" (
 id TEXT PRIMARY KEY, "manifestDigest" TEXT NOT NULL, "stateJson" JSONB NOT NULL,
 version INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "PlatformManualRelease_createdAt_id_idx" ON "PlatformManualRelease" ("createdAt",id);
CREATE TABLE "PlatformManualReleaseEvent" (
 id TEXT PRIMARY KEY, "recordId" TEXT NOT NULL REFERENCES "PlatformManualRelease"(id) ON DELETE RESTRICT,
 sequence INTEGER NOT NULL, kind TEXT NOT NULL, "detailJson" JSONB NOT NULL,
 "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("recordId",sequence)
);

CREATE TABLE "PlatformOperationalDelegation" (
 "actionId" TEXT PRIMARY KEY REFERENCES "PlatformGovernanceAction"(id) ON DELETE RESTRICT,
 "manifestDigest" TEXT NOT NULL, "parentPlanDigest" TEXT NOT NULL, "stateJson" JSONB NOT NULL,
 version INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "PlatformOperationalWorkloadUse" (
 "replayKey" TEXT PRIMARY KEY, "actionId" TEXT NOT NULL REFERENCES "PlatformOperationalDelegation"("actionId") ON DELETE RESTRICT,
 "manifestDigest" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PlatformOperationalWorkloadUse_actionId_idx" ON "PlatformOperationalWorkloadUse" ("actionId");

CREATE TABLE "PlatformOperationalTarget" (
 "nativeKey" TEXT PRIMARY KEY, "actionId" TEXT NOT NULL REFERENCES "PlatformGovernanceAction"(id) ON DELETE RESTRICT,
 generation INTEGER NOT NULL, version INTEGER NOT NULL, "stateJson" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "PlatformOperationalTargetReceipt" (
 id TEXT PRIMARY KEY, "nativeKey" TEXT NOT NULL REFERENCES "PlatformOperationalTarget"("nativeKey") ON DELETE RESTRICT,
 generation INTEGER NOT NULL, "actionId" TEXT NOT NULL REFERENCES "PlatformGovernanceAction"(id) ON DELETE RESTRICT,
 "receiptDigest" TEXT NOT NULL, "receiptJson" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PlatformOperationalTargetReceipt_nativeKey_generation_idx" ON "PlatformOperationalTargetReceipt" ("nativeKey",generation);

-- Private encrypted settings, fixture only. No update/delete path in repository.
CREATE TABLE "PlatformSettingsArtifact" (
 id TEXT PRIMARY KEY, "actionId" TEXT NOT NULL REFERENCES "PlatformGovernanceAction"(id) ON DELETE RESTRICT,
 "effectIndex" INTEGER NOT NULL CHECK ("effectIndex" BETWEEN 0 AND 31),
 "bindingJson" JSONB NOT NULL, envelope TEXT NOT NULL, "createdAtMs" DOUBLE PRECISION NOT NULL,
 UNIQUE ("actionId","effectIndex")
);

-- Proposed platform-scoped issuer admission/intent storage; fixture only.
CREATE TABLE "PlatformCustodianBarrier" (
 "nativeKey" TEXT PRIMARY KEY, "controlActionId" TEXT NOT NULL REFERENCES "PlatformGovernanceAction"(id) ON DELETE RESTRICT,
 version INTEGER NOT NULL, "stateJson" JSONB NOT NULL
);
CREATE TABLE "PlatformCustodianIntent" (
 id TEXT PRIMARY KEY, "nativeKey" TEXT NOT NULL REFERENCES "PlatformCustodianBarrier"("nativeKey") ON DELETE RESTRICT,
 "actionId" TEXT NOT NULL REFERENCES "PlatformGovernanceAction"(id) ON DELETE RESTRICT,
 "stateJson" JSONB NOT NULL
);
CREATE INDEX "PlatformCustodianIntent_nativeKey_idx" ON "PlatformCustodianIntent" ("nativeKey");
