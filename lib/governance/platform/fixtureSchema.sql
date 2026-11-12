-- Fresh owned isolated test database ONLY. Not a production migration/apply file.
CREATE TABLE "PlatformGovernanceAction" (
 id TEXT PRIMARY KEY, "planDigest" TEXT NOT NULL, "stateJson" JSONB NOT NULL,
 version INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
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
