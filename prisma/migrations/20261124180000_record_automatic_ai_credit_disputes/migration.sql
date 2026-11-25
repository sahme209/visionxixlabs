CREATE TABLE "AutomaticAICreditDispute" (
    "id" TEXT PRIMARY KEY,
    "intentId" TEXT NOT NULL REFERENCES "AutomaticAICreditDispatchClaim"("intentId"),
    "chargeId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL CHECK ("amountCents" > 0),
    "state" TEXT NOT NULL CHECK ("state" IN ('held', 'inquiry', 'warning_closed', 'won', 'lost'))
);
CREATE INDEX "AutomaticAICreditDispute_intentId_idx" ON "AutomaticAICreditDispute"("intentId");
ALTER TABLE "AutomaticAICreditDispatchClaim" ADD COLUMN "disputeRevision" INTEGER NOT NULL DEFAULT 0;
