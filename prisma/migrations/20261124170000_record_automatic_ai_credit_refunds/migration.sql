ALTER TABLE "AutomaticAICreditDispatchClaim"
    ADD COLUMN "refundChargeId" TEXT,
    ADD COLUMN "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,
    ADD CONSTRAINT "AutomaticAICreditDispatchClaim_refund_check" CHECK (
        ("refundChargeId" IS NULL AND "refundedAmountCents" = 0)
        OR ("refundChargeId" IS NOT NULL AND "paymentIntentId" IS NOT NULL AND "refundedAmountCents" > 0)
    );
