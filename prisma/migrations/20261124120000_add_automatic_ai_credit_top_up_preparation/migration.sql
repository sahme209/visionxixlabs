CREATE TABLE "AutomaticAICreditTopUpConsent" (
    "organizationId" TEXT PRIMARY KEY,
    "revision" INTEGER NOT NULL CHECK ("revision" > 0),
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "consentedByUserId" TEXT NOT NULL,
    "providerConsentRef" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL,
    "thresholdCents" INTEGER NOT NULL CHECK ("thresholdCents" >= 0),
    "sku" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL CHECK ("amountCents" > 0),
    "monthlyCeilingCents" INTEGER NOT NULL CHECK ("monthlyCeilingCents" >= "amountCents")
);

CREATE TABLE "AutomaticAICreditTopUpIntent" (
    "id" TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "consentRevision" INTEGER NOT NULL CHECK ("consentRevision" > 0),
    "periodMonth" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL CHECK ("amountCents" > 0),
    "state" TEXT NOT NULL CHECK ("state" IN ('prepared','dispatch_unknown','authentication_required','payment_failed','paid','canceled')),
    "createdAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "AutomaticAICreditTopUpIntent_org_month_idx"
    ON "AutomaticAICreditTopUpIntent" ("organizationId", "periodMonth");

-- Unknown outcomes and customer-action states block another purchase even after rollover.
CREATE UNIQUE INDEX "AutomaticAICreditTopUpIntent_one_open_per_workspace"
    ON "AutomaticAICreditTopUpIntent" ("organizationId")
    WHERE "state" IN ('prepared','dispatch_unknown','authentication_required','payment_failed');
