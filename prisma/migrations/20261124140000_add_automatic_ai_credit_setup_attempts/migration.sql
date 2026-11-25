CREATE TABLE "AutomaticAICreditSetupAttempt" (
    id TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    terms JSONB NOT NULL,
    "consentDigest" TEXT NOT NULL,
    "setupIntentId" TEXT UNIQUE,
    "createClaimed" BOOLEAN NOT NULL DEFAULT false,
    state TEXT NOT NULL CHECK (state IN ('pending','canceled','consumed')),
    "createdAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "AutomaticAICreditSetupAttempt_one_pending_per_workspace"
    ON "AutomaticAICreditSetupAttempt" ("organizationId") WHERE state='pending';
