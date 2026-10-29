-- LOCAL PROPOSAL ONLY. Apply only with separate reviewed database authorization.
CREATE TABLE "AwsGuidedConnectionFlow" (
 "id" TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"userId" TEXT NOT NULL,"sessionId" TEXT NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 0,"state" TEXT NOT NULL DEFAULT 'review',"attemptCount" INTEGER NOT NULL DEFAULT 0,
 "connectionJson" JSONB,"inputJson" JSONB NOT NULL,"sealedChallenge" TEXT NOT NULL,"callbackDigest" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "AwsGuidedConnectionFlow_bounds" CHECK ("version" BETWEEN 0 AND 5 AND "attemptCount" BETWEEN 0 AND 1 AND octet_length("inputJson"::text)<=20000 AND length("sealedChallenge")<=30000 AND "callbackDigest" ~ '^[a-f0-9]{64}$'),
 CONSTRAINT "AwsGuidedConnectionFlow_states" CHECK ("state" IN ('review','waiting_for_aws','verifying','connected_read_only','unknown','cancelled','expired'))
);
CREATE INDEX "AwsGuidedConnectionFlow_organizationId_userId_createdAt_idx" ON "AwsGuidedConnectionFlow"("organizationId","userId","createdAt");
CREATE FUNCTION "axiom_aws_guided_identity_guard"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."id"<>OLD."id" OR NEW."organizationId"<>OLD."organizationId" OR NEW."userId"<>OLD."userId" OR NEW."sessionId"<>OLD."sessionId" OR NEW."inputJson"<>OLD."inputJson" OR NEW."sealedChallenge"<>OLD."sealedChallenge" OR NEW."callbackDigest"<>OLD."callbackDigest" OR NEW."expiresAt"<>OLD."expiresAt" OR NEW."createdAt"<>OLD."createdAt" OR NEW."version"<>OLD."version"+1 OR NEW."attemptCount"<OLD."attemptCount" THEN RAISE EXCEPTION 'aws_guided_identity_changed'; END IF;
 IF OLD."state" IN ('connected_read_only','unknown','cancelled','expired') THEN RAISE EXCEPTION 'aws_guided_terminal'; END IF;
 IF NEW."state" IN ('waiting_for_aws','verifying','connected_read_only') AND NEW."expiresAt"<=clock_timestamp() THEN RAISE EXCEPTION 'aws_guided_expired'; END IF;
 IF NOT ((OLD."state"='review' AND NEW."state" IN ('waiting_for_aws','cancelled') AND NEW."attemptCount"=0) OR (OLD."state"='waiting_for_aws' AND ((NEW."state"='verifying' AND NEW."attemptCount"=1) OR (NEW."state"='cancelled' AND NEW."attemptCount"=0))) OR (OLD."state"='verifying' AND NEW."state" IN ('connected_read_only','unknown') AND NEW."attemptCount"=1)) THEN RAISE EXCEPTION 'aws_guided_transition_invalid'; END IF;
 IF (NEW."connectionJson" IS DISTINCT FROM OLD."connectionJson") AND NOT (OLD."state"='verifying' AND NEW."state"='connected_read_only' AND OLD."connectionJson" IS NULL AND NEW."connectionJson" IS NOT NULL) THEN RAISE EXCEPTION 'aws_guided_connection_binding_changed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "AwsGuidedConnectionFlow_identity_guard" BEFORE UPDATE ON "AwsGuidedConnectionFlow" FOR EACH ROW EXECUTE FUNCTION "axiom_aws_guided_identity_guard"();
