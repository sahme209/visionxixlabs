-- Minimal source-compatible identity columns for owned SQL tests only.
-- This is not full production schema or a migration.
CREATE TABLE "User" (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE);
CREATE TABLE "DesktopSessionRecord" (
 id TEXT PRIMARY KEY,"userId" TEXT NOT NULL,"organizationId" TEXT NOT NULL,
 "issuedAt" TIMESTAMP(3) NOT NULL,"expiresAt" TIMESTAMP(3) NOT NULL,"revokedAt" TIMESTAMP(3)
);
CREATE TABLE "OrgMembership" (
 "userId" TEXT NOT NULL,"organizationId" TEXT NOT NULL,"acceptedAt" TIMESTAMP(3),
 PRIMARY KEY("userId","organizationId")
);
