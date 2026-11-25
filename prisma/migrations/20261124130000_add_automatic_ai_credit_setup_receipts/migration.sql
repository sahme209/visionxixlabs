CREATE TABLE "AutomaticAICreditSetupReceipt" (
    "setupIntentId" TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "consentRevision" INTEGER NOT NULL CHECK ("consentRevision" > 0),
    "customerId" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    "consentDigest" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AutomaticAICreditSetupReceipt_org_revision_key" UNIQUE ("organizationId", "consentRevision")
);
