ALTER TABLE "AutomaticAICreditDispatchClaim"
    ADD COLUMN "paymentIntentId" TEXT UNIQUE,
    ADD COLUMN "providerStatus" TEXT,
    ADD COLUMN "observedAt" TIMESTAMP(3),
    ADD CONSTRAINT "AutomaticAICreditDispatchClaim_observation_check" CHECK (
        ("paymentIntentId" IS NULL AND "providerStatus" IS NULL AND "observedAt" IS NULL)
        OR ("paymentIntentId" IS NOT NULL AND "providerStatus" IS NOT NULL AND "observedAt" IS NOT NULL)
    );
