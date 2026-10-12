ALTER TABLE "TenantBillingPlan"
ADD COLUMN "seatQuantity" INTEGER;

ALTER TABLE "TenantBillingPlan"
ADD CONSTRAINT "TenantBillingPlan_seatQuantity_check"
CHECK ("seatQuantity" IS NULL OR "seatQuantity" > 0);
