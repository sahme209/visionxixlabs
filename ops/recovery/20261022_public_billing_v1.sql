-- Additive public-plan fulfillment storage. NOT an automatic build migration.
-- Rehearse with synthetic data and verify target/recovery before live execution.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
  IF to_regclass('public."PublicBillingEnrollment"') IS NOT NULL
    OR to_regclass('public."PublicCheckoutIntent"') IS NOT NULL
    OR to_regclass('public."PublicSubscriptionContract"') IS NOT NULL
    OR to_regclass('public."PublicInvoiceCollection"') IS NOT NULL
    OR to_regclass('public."PublicBillingEvent"') IS NOT NULL
    OR to_regclass('public."PublicCreditAttribution"') IS NOT NULL
  THEN RAISE EXCEPTION 'public_billing_schema_already_or_partially_present'; END IF;
END $$;
CREATE TABLE "PublicBillingEnrollment" (
  "organizationId" TEXT PRIMARY KEY, id TEXT NOT NULL UNIQUE,
  "accountId" TEXT NOT NULL, livemode BOOLEAN NOT NULL,
  policy TEXT NOT NULL CHECK(policy='axiom_public_anniversary_v1'),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
  "legacyFreeMonth" TEXT NOT NULL CHECK("legacyFreeMonth" ~ '^[0-9]{4}-[0-9]{2}$'),
  "legacyFreeUsedCents" INTEGER NOT NULL CHECK("legacyFreeUsedCents">=0)
);
CREATE TABLE "PublicCheckoutIntent" (
  id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "PublicBillingEnrollment"("organizationId"),
  revision INTEGER NOT NULL CHECK(revision>=0), state TEXT NOT NULL CHECK(state IN ('prepared','attempted','unknown','confirmed','bound','expired')),
  "providerKey" TEXT NOT NULL UNIQUE, "sessionId" TEXT UNIQUE, body JSONB NOT NULL,
  CHECK(body->>'id'=id AND body->>'organizationId'="organizationId" AND body->>'state'=state),
  CHECK((body->>'revision')::integer=revision AND body->>'providerKey'="providerKey"),
  CHECK(body->>'requestDigest' ~ '^[a-f0-9]{64}$'),
  CHECK((state IN ('prepared','attempted','unknown') AND "sessionId" IS NULL) OR (state IN ('confirmed','bound','expired') AND "sessionId" IS NOT NULL AND body->>'originalCreateProofDigest' ~ '^[a-f0-9]{64}$'))
);
CREATE UNIQUE INDEX "PublicCheckoutIntent_one_unresolved" ON "PublicCheckoutIntent"("organizationId") WHERE state<>'expired';
CREATE TABLE "PublicSubscriptionContract" (
  "organizationId" TEXT PRIMARY KEY REFERENCES "PublicBillingEnrollment"("organizationId"),
  "intentId" TEXT NOT NULL UNIQUE REFERENCES "PublicCheckoutIntent"(id),
  "subscriptionId" TEXT NOT NULL UNIQUE, "customerId" TEXT NOT NULL UNIQUE,
  revision INTEGER NOT NULL CHECK(revision>=0), body JSONB NOT NULL,
  CHECK(body->>'organizationId'="organizationId" AND (body->>'revision')::integer=revision),
  CHECK(body->'binding'->>'intentId'="intentId" AND body->'binding'->>'subscriptionId'="subscriptionId" AND body->'binding'->>'customerId'="customerId")
);
CREATE TABLE "PublicInvoiceCollection" (
  "invoiceId" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "PublicBillingEnrollment"("organizationId"),
  digest TEXT NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'), body JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
  CHECK(body->>'invoiceId'="invoiceId" AND body->>'organizationId'="organizationId" AND body->>'evidenceDigest'=digest)
);
CREATE TABLE "PublicBillingEvent" (
  id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "PublicBillingEnrollment"("organizationId"),
  type TEXT NOT NULL, "processedAt" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC')
);
CREATE TABLE "PublicCreditAttribution" (
  "reservationId" TEXT PRIMARY KEY REFERENCES "AIUsageReservation"(id),
  "organizationId" TEXT NOT NULL REFERENCES "PublicBillingEnrollment"("organizationId"),
  body JSONB NOT NULL,
  CHECK(body->>'organizationId'="organizationId" AND body->>'reservationId'="reservationId")
);
CREATE INDEX "PublicCreditAttribution_org" ON "PublicCreditAttribution"("organizationId");
CREATE INDEX "PublicInvoiceCollection_org" ON "PublicInvoiceCollection"("organizationId");
CREATE FUNCTION public_billing_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'public_billing_immutable_evidence'; END $$;
CREATE TRIGGER public_enrollment_immutable BEFORE UPDATE OR DELETE ON "PublicBillingEnrollment" FOR EACH ROW EXECUTE FUNCTION public_billing_immutable();
CREATE TRIGGER public_collection_immutable BEFORE UPDATE OR DELETE ON "PublicInvoiceCollection" FOR EACH ROW EXECUTE FUNCTION public_billing_immutable();
CREATE TRIGGER public_attribution_immutable BEFORE UPDATE OR DELETE ON "PublicCreditAttribution" FOR EACH ROW EXECUTE FUNCTION public_billing_immutable();
CREATE FUNCTION public_checkout_intent_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'public_checkout_intent_immutable'; END IF;
  IF NEW.id<>OLD.id OR NEW."organizationId"<>OLD."organizationId" OR NEW."providerKey"<>OLD."providerKey" OR NEW.revision<>OLD.revision+1
    OR (NEW.body - ARRAY['state','revision','sessionId','sessionUrl','expiresAt','originalCreateProofDigest']) IS DISTINCT FROM (OLD.body - ARRAY['state','revision','sessionId','sessionUrl','expiresAt','originalCreateProofDigest'])
    OR NOT ((OLD.state='prepared' AND NEW.state='attempted') OR (OLD.state='attempted' AND NEW.state IN ('unknown','confirmed')) OR (OLD.state='confirmed' AND NEW.state IN ('bound','expired')))
    OR (OLD."sessionId" IS NOT NULL AND (NEW."sessionId" IS DISTINCT FROM OLD."sessionId" OR NEW.body->>'originalCreateProofDigest' IS DISTINCT FROM OLD.body->>'originalCreateProofDigest'))
  THEN RAISE EXCEPTION 'public_checkout_intent_mutation_rejected'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER public_intent_guard BEFORE UPDATE OR DELETE ON "PublicCheckoutIntent" FOR EACH ROW EXECUTE FUNCTION public_checkout_intent_guard();
CREATE FUNCTION public_subscription_contract_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'public_subscription_contract_immutable'; END IF;
  IF NEW."organizationId"<>OLD."organizationId" OR NEW."intentId"<>OLD."intentId" OR NEW."subscriptionId"<>OLD."subscriptionId" OR NEW."customerId"<>OLD."customerId" OR NEW.revision<>OLD.revision+1
    OR NEW.body->'binding' IS DISTINCT FROM OLD.body->'binding' OR NEW.body->>'anchor' IS DISTINCT FROM OLD.body->>'anchor' OR NEW.body->>'firstCollectionDigest' IS DISTINCT FROM OLD.body->>'firstCollectionDigest'
  THEN RAISE EXCEPTION 'public_subscription_contract_mutation_rejected'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER public_contract_guard BEFORE UPDATE OR DELETE ON "PublicSubscriptionContract" FOR EACH ROW EXECUTE FUNCTION public_subscription_contract_guard();
COMMIT;
