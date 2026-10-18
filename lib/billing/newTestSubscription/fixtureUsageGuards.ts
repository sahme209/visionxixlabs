/** Owned fixture DDL only; never installed by an application import/migration.
 * Existing financial rows are guarded, not copied into a parallel ledger. */
export const fixtureUsageGuardsDDL = [
  `CREATE FUNCTION guard_test_hold_transition() RETURNS trigger LANGUAGE plpgsql AS $$
  DECLARE v_org text; BEGIN
    IF TG_OP='DELETE' THEN v_org:=OLD."organizationId"; ELSE v_org:=NEW."organizationId"; END IF;
    IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM "OrganizationTestAllowanceEnrollment" WHERE org=OLD."organizationId") THEN v_org:=OLD."organizationId"; END IF;
    IF NOT EXISTS(SELECT 1 FROM "OrganizationTestAllowanceEnrollment" WHERE org=v_org) THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'test_hold_immutable'; END IF;
    IF TG_OP='INSERT' THEN
      IF NEW.status<>'reserved' OR NEW."usageEventId" IS NOT NULL OR NEW."settledCents" IS NOT NULL OR NEW."reservedCents"<1 THEN RAISE EXCEPTION 'test_hold_initial_state'; END IF;
    ELSE
      IF ROW(OLD.id,OLD."organizationId",OLD."idempotencyKey",OLD."reservedCents",OLD."expiresAt",OLD."createdAt") IS DISTINCT FROM ROW(NEW.id,NEW."organizationId",NEW."idempotencyKey",NEW."reservedCents",NEW."expiresAt",NEW."createdAt") THEN RAISE EXCEPTION 'test_hold_immutable'; END IF;
      IF OLD.status=NEW.status THEN
        IF ROW(OLD."usageEventId",OLD."settledCents",OLD."settledAt",OLD."releasedAt") IS DISTINCT FROM ROW(NEW."usageEventId",NEW."settledCents",NEW."settledAt",NEW."releasedAt") THEN RAISE EXCEPTION 'test_hold_transition'; END IF;
      ELSIF OLD.status='reserved' AND NEW.status IN ('released','expired') AND OLD."usageEventId" IS NULL THEN
        IF NEW.status='expired' AND NEW."expiresAt" AT TIME ZONE 'UTC'>clock_timestamp() THEN RAISE EXCEPTION 'test_hold_expiry'; END IF;
      ELSIF OLD.status='reserved' AND NEW.status='dispatch_unknown' AND OLD."usageEventId" IS NULL AND OLD."expiresAt" AT TIME ZONE 'UTC'>clock_timestamp() THEN NULL;
      ELSIF OLD.status='dispatch_unknown' AND NEW.status IN ('pending_settlement','settled') AND OLD."usageEventId" IS NULL THEN NULL;
      ELSIF OLD.status='pending_settlement' AND NEW.status='settled' AND OLD."usageEventId" IS NOT DISTINCT FROM NEW."usageEventId" THEN NULL;
      ELSE RAISE EXCEPTION 'test_hold_transition'; END IF;
    END IF;
    IF NEW.status IN ('reserved','dispatch_unknown','released','expired') AND (NEW."usageEventId" IS NOT NULL OR NEW."settledCents" IS NOT NULL) THEN RAISE EXCEPTION 'test_hold_link'; END IF;
    IF NEW.status='pending_settlement' AND (NEW."usageEventId" IS NULL OR NEW."settledCents" IS NOT NULL) OR NEW.status='settled' AND (NEW."usageEventId" IS NULL OR NEW."settledCents" IS NULL OR NEW."settledCents"<0 OR NEW."settledCents">NEW."reservedCents") THEN RAISE EXCEPTION 'test_hold_settlement'; END IF;
    RETURN NEW;
  END $$`,
  'CREATE TRIGGER guard_test_hold_transition BEFORE INSERT OR UPDATE OR DELETE ON "AIUsageReservation" FOR EACH ROW EXECUTE FUNCTION guard_test_hold_transition()',
  `CREATE FUNCTION guard_test_usage_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
  DECLARE r jsonb; a record; h record; ceiling jsonb; expected jsonb:='[]'; remaining bigint; n bigint; common jsonb;
  BEGIN
    IF TG_OP='DELETE' THEN
      IF EXISTS(SELECT 1 FROM "OrganizationTestAllowanceEnrollment" WHERE org=OLD."organizationId") AND OLD."eventKind"='ai_invocation' THEN RAISE EXCEPTION 'test_usage_immutable'; END IF; RETURN OLD;
    END IF;
    IF TG_OP='UPDATE' AND OLD."organizationId" IS DISTINCT FROM NEW."organizationId" AND EXISTS(SELECT 1 FROM "OrganizationTestAllowanceEnrollment" WHERE org IN (OLD."organizationId",NEW."organizationId")) THEN RAISE EXCEPTION 'test_usage_scope'; END IF;
    IF NOT EXISTS(SELECT 1 FROM "OrganizationTestAllowanceEnrollment" WHERE org=NEW."organizationId") THEN RETURN NEW; END IF;
    IF TG_OP='UPDATE' AND OLD."eventKind"='ai_invocation' AND NEW."eventKind" IS DISTINCT FROM OLD."eventKind" THEN RAISE EXCEPTION 'test_usage_kind'; END IF;
    IF NEW."eventKind"<>'ai_invocation' THEN IF NEW.metadata ? 'axiomTestAllocationV2' THEN RAISE EXCEPTION 'test_usage_kind'; END IF; RETURN NEW; END IF;
    r:=NEW.metadata->'axiomTestAllocationV2';
    IF r IS NULL OR jsonb_typeof(r)<>'object' THEN RAISE EXCEPTION 'test_usage_unattributed'; END IF;
    SELECT * INTO STRICT h FROM "AIUsageReservation" WHERE id=r->>'reservationId' AND "organizationId"=NEW."organizationId";
    SELECT * INTO STRICT a FROM "NewTestReservationAttribution" WHERE "reservationId"=h.id AND org=NEW."organizationId";
    common:=jsonb_build_object('version',2,'reservationId',h.id,'attributionDigest',a.body->>'digest','enrollmentDigest',a.body->>'enrollmentDigest','basisDigest',a.body->>'basisDigest','bucketId',a.body->>'bucketId','kind',a.body->>'kind','windowStart',a.body->>'windowStart','windowEnd',a.body->>'windowEnd','admittedAt',a.body->>'admittedAt');
    IF r-ARRAY['state','allocation'] IS DISTINCT FROM common THEN RAISE EXCEPTION 'test_usage_scope'; END IF;
    IF NEW."costCents"<0 OR NEW."billedCents"<0 OR NEW."billedCents">h."reservedCents" THEN RAISE EXCEPTION 'test_usage_amount'; END IF;
    IF r->>'state'='pending' THEN
      IF NEW."billingStatus"<>'pending' OR NEW."billedCents"<>0 OR NEW."costCents"<>0 OR r ? 'allocation' OR NEW.provider<>'vercel_gateway' OR NEW."externalUsageId" IS NULL THEN RAISE EXCEPTION 'test_usage_pending'; END IF;
    ELSIF r->>'state'='settled' THEN
      IF NEW."billingStatus"<>'settled' OR jsonb_typeof(r->'allocation') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'test_usage_settled'; END IF;
      remaining:=NEW."billedCents";
      FOR ceiling IN SELECT * FROM jsonb_array_elements(a.body->'allocation') LOOP
        n:=least(remaining,(ceiling->>'maxCents')::bigint);
        IF n>0 THEN
          IF ceiling->>'source'='included' THEN expected:=expected||jsonb_build_array(jsonb_build_object('source','included','bucketId',ceiling->>'bucketId','cents',n));
          ELSE expected:=expected||jsonb_build_array(jsonb_build_object('source','purchase','purchaseId',ceiling->>'purchaseId','cents',n)); END IF;
        END IF; remaining:=remaining-n;
      END LOOP;
      IF remaining<>0 OR r->'allocation' IS DISTINCT FROM expected THEN RAISE EXCEPTION 'test_usage_allocation'; END IF;
    ELSE RAISE EXCEPTION 'test_usage_state'; END IF;
    IF TG_OP='UPDATE' THEN
      IF ROW(OLD.id,OLD."organizationId",OLD."externalUsageId",OLD."eventKind",OLD.provider,OLD."createdAt") IS DISTINCT FROM ROW(NEW.id,NEW."organizationId",NEW."externalUsageId",NEW."eventKind",NEW.provider,NEW."createdAt") THEN RAISE EXCEPTION 'test_usage_immutable'; END IF;
      IF OLD."billingStatus"='settled' AND to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN RAISE EXCEPTION 'test_usage_immutable'; END IF;
      IF OLD."billingStatus"='pending' AND (OLD.metadata-'axiomTestAllocationV2' IS DISTINCT FROM NEW.metadata-'axiomTestAllocationV2' OR (OLD.metadata->'axiomTestAllocationV2')-ARRAY['state','allocation'] IS DISTINCT FROM common OR NEW."billingStatus" NOT IN ('pending','settled')) THEN RAISE EXCEPTION 'test_usage_transition'; END IF;
    END IF; RETURN NEW;
  END $$`,
  'CREATE TRIGGER guard_test_usage_allocation BEFORE INSERT OR UPDATE OR DELETE ON "UsageEvent" FOR EACH ROW EXECUTE FUNCTION guard_test_usage_allocation()',
  `CREATE UNIQUE INDEX test_one_usage_per_attributed_hold ON "UsageEvent" ((metadata->'axiomTestAllocationV2'->>'reservationId')) WHERE metadata ? 'axiomTestAllocationV2'`,
  `CREATE FUNCTION check_test_hold_link() RETURNS trigger LANGUAGE plpgsql AS $$
  DECLARE h record; a record; u record;
  BEGIN
    SELECT * INTO h FROM "AIUsageReservation" WHERE id=NEW.id;
    IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM "OrganizationTestAllowanceEnrollment" WHERE org=h."organizationId") THEN RETURN NULL; END IF;
    SELECT * INTO STRICT a FROM "NewTestReservationAttribution" WHERE "reservationId"=h.id AND org=h."organizationId";
    IF a."releaseEvidence" IS NOT NULL THEN RAISE EXCEPTION 'test_unused_proof_unsupported'; END IF;
    IF h."usageEventId" IS NOT NULL THEN
      SELECT * INTO STRICT u FROM "UsageEvent" WHERE id=h."usageEventId" AND "organizationId"=h."organizationId";
      IF u.metadata->'axiomTestAllocationV2'->>'reservationId' IS DISTINCT FROM h.id OR u.metadata->'axiomTestAllocationV2'->>'attributionDigest' IS DISTINCT FROM a.body->>'digest' OR (h.status='settled' AND (u."billingStatus"<>'settled' OR h."settledCents" IS DISTINCT FROM u."billedCents")) OR (h.status='pending_settlement' AND u."billingStatus"<>'pending') THEN RAISE EXCEPTION 'test_hold_usage_link'; END IF;
    END IF; RETURN NULL;
  END $$`,
  'CREATE CONSTRAINT TRIGGER check_test_hold_link AFTER INSERT OR UPDATE ON "AIUsageReservation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_test_hold_link()',
  `CREATE FUNCTION check_test_usage_link() RETURNS trigger LANGUAGE plpgsql AS $$
  DECLARE u record; h record;
  BEGIN
    SELECT * INTO u FROM "UsageEvent" WHERE id=NEW.id;
    IF NOT FOUND OR u."eventKind"<>'ai_invocation' OR NOT EXISTS(SELECT 1 FROM "OrganizationTestAllowanceEnrollment" WHERE org=u."organizationId") THEN RETURN NULL; END IF;
    SELECT * INTO STRICT h FROM "AIUsageReservation" WHERE id=u.metadata->'axiomTestAllocationV2'->>'reservationId' AND "organizationId"=u."organizationId";
    IF h."usageEventId" IS DISTINCT FROM u.id OR (u."billingStatus"='pending' AND h.status<>'pending_settlement') OR (u."billingStatus"='settled' AND (h.status<>'settled' OR h."settledCents" IS DISTINCT FROM u."billedCents")) THEN RAISE EXCEPTION 'test_usage_hold_link'; END IF; RETURN NULL;
  END $$`,
  'CREATE CONSTRAINT TRIGGER check_test_usage_link AFTER INSERT OR UPDATE ON "UsageEvent" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_test_usage_link()',
];
