CREATE TABLE "AutomaticAICreditDispatchClaim" (
    "intentId" TEXT PRIMARY KEY REFERENCES "AutomaticAICreditTopUpIntent"(id),
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL UNIQUE,
    "requestJson" TEXT NOT NULL,
    "requestDigest" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL
);
