-- LOCAL ONLY. Fixed read operation, separate from readiness and AI ledgers.
CREATE TABLE "BotPullRequestEvidenceRun" (
 "id" TEXT PRIMARY KEY CHECK ("id" ~ '^botpr_[a-f0-9]{64}$'),
 "organizationId" TEXT NOT NULL, "createdByUserId" TEXT NOT NULL,
 "taskId" TEXT NOT NULL CHECK ("taskId" ~ '^bot_[a-f0-9]{64}$'),
 "taskVersion" INTEGER NOT NULL CHECK ("taskVersion">=0), "clientRequestId" TEXT NOT NULL,
 "kind" TEXT NOT NULL CHECK ("kind"='release_pull_request_evidence_v1'),
 "intentHash" TEXT NOT NULL CHECK ("intentHash" ~ '^[a-f0-9]{64}$'),
 "snapshotJson" JSONB NOT NULL CHECK (octet_length("snapshotJson"::text)<=32768),
 "snapshotDigest" TEXT NOT NULL CHECK ("snapshotDigest" ~ '^[a-f0-9]{64}$'),
 "status" TEXT NOT NULL DEFAULT 'queued' CHECK ("status" IN ('queued','running','cancel_requested','completed','failed','canceled','outcome_unknown')),
 "revision" INTEGER NOT NULL DEFAULT 0 CHECK ("revision">=0),
 "attemptCount" INTEGER NOT NULL DEFAULT 0 CHECK ("attemptCount" BETWEEN 0 AND 1),
 "eventCount" INTEGER NOT NULL CHECK ("eventCount" BETWEEN 1 AND 12),
 "storedBytes" INTEGER NOT NULL CHECK ("storedBytes" BETWEEN 0 AND 65536),
 "cancelRequested" BOOLEAN NOT NULL DEFAULT false, "leaseOwner" TEXT, "leaseExpiresAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 "deadlineAt" TIMESTAMP(3) NOT NULL,
 CHECK ("deadlineAt"="createdAt"+INTERVAL '45 seconds'),
 CHECK (("leaseOwner" IS NULL)=("leaseExpiresAt" IS NULL))
);
CREATE UNIQUE INDEX "BotPullRequestEvidenceRun_owner_id_key" ON "BotPullRequestEvidenceRun"("organizationId","createdByUserId","id");
CREATE UNIQUE INDEX "BotPullRequestEvidenceRun_owner_request_key" ON "BotPullRequestEvidenceRun"("organizationId","createdByUserId","clientRequestId");
CREATE INDEX "BotPullRequestEvidenceRun_owner_created_idx" ON "BotPullRequestEvidenceRun"("organizationId","createdByUserId","createdAt","id");
CREATE TABLE "BotPullRequestEvidenceEvent" (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "createdByUserId" TEXT NOT NULL, "runId" TEXT NOT NULL,
 "sequence" INTEGER NOT NULL CHECK ("sequence" BETWEEN 0 AND 11),
 "eventType" TEXT NOT NULL CHECK ("eventType" IN ('run.queued','run.running','run.cancel_requested','run.completed','run.failed','run.canceled','run.outcome_unknown')),
 "payloadJson" JSONB NOT NULL CHECK (octet_length("payloadJson"::text)<=1024), "occurredAt" TIMESTAMP(3) NOT NULL,
 FOREIGN KEY ("organizationId","createdByUserId","runId") REFERENCES "BotPullRequestEvidenceRun"("organizationId","createdByUserId","id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "BotPullRequestEvidenceEvent_run_sequence_key" ON "BotPullRequestEvidenceEvent"("runId","sequence");
CREATE INDEX "BotPullRequestEvidenceEvent_owner_run_sequence_idx" ON "BotPullRequestEvidenceEvent"("organizationId","createdByUserId","runId","sequence");
CREATE TABLE "BotPullRequestEvidenceArtifact" (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "createdByUserId" TEXT NOT NULL, "runId" TEXT NOT NULL UNIQUE,
 "kind" TEXT NOT NULL CHECK ("kind"='release_pull_request_evidence'),
 "content" TEXT NOT NULL CHECK (octet_length("content")<=16384 AND jsonb_typeof("content"::jsonb)='object'),
 "contentHash" TEXT NOT NULL CHECK ("contentHash" ~ '^[a-f0-9]{64}$'),
 "snapshotDigest" TEXT NOT NULL CHECK ("snapshotDigest" ~ '^[a-f0-9]{64}$'),
 "observedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL,
 FOREIGN KEY ("organizationId","createdByUserId","runId") REFERENCES "BotPullRequestEvidenceRun"("organizationId","createdByUserId","id") ON DELETE RESTRICT
);
CREATE INDEX "BotPullRequestEvidenceArtifact_owner_run_idx" ON "BotPullRequestEvidenceArtifact"("organizationId","createdByUserId","runId");
CREATE FUNCTION axiom_bot_pr_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'bot_pr_evidence_immutable'; END; $$;
CREATE TRIGGER "BotPullRequestEvidenceEvent_immutable" BEFORE UPDATE OR DELETE ON "BotPullRequestEvidenceEvent" FOR EACH ROW EXECUTE FUNCTION axiom_bot_pr_immutable();
CREATE TRIGGER "BotPullRequestEvidenceArtifact_immutable" BEFORE UPDATE OR DELETE ON "BotPullRequestEvidenceArtifact" FOR EACH ROW EXECUTE FUNCTION axiom_bot_pr_immutable();
CREATE FUNCTION axiom_bot_pr_state_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'bot_pr_identity_immutable'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW."status"<>'queued' OR NEW."revision"<>0 OR NEW."attemptCount"<>0 OR NEW."eventCount"<>1 OR NEW."cancelRequested" OR NEW."leaseOwner" IS NOT NULL OR NEW."leaseExpiresAt" IS NOT NULL THEN RAISE EXCEPTION 'bot_pr_initial_state'; END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW."id",NEW."organizationId",NEW."createdByUserId",NEW."taskId",NEW."taskVersion",NEW."clientRequestId",NEW."kind",NEW."intentHash",NEW."snapshotJson",NEW."snapshotDigest",NEW."createdAt",NEW."deadlineAt") IS DISTINCT FROM ROW(OLD."id",OLD."organizationId",OLD."createdByUserId",OLD."taskId",OLD."taskVersion",OLD."clientRequestId",OLD."kind",OLD."intentHash",OLD."snapshotJson",OLD."snapshotDigest",OLD."createdAt",OLD."deadlineAt") THEN RAISE EXCEPTION 'bot_pr_identity_immutable'; END IF;
 IF OLD."status" IN ('completed','failed','canceled','outcome_unknown') THEN RAISE EXCEPTION 'bot_pr_terminal_immutable'; END IF;
 IF NEW."revision"<>OLD."revision"+1 OR NEW."eventCount"<>OLD."eventCount"+1 OR NEW."storedBytes"<OLD."storedBytes" OR (OLD."cancelRequested" AND NOT NEW."cancelRequested") THEN RAISE EXCEPTION 'bot_pr_monotonic_required'; END IF;
 IF NOT ((OLD."status"='queued' AND NEW."status" IN ('running','canceled','failed')) OR (OLD."status"='running' AND NEW."status" IN ('completed','failed','cancel_requested','outcome_unknown')) OR (OLD."status"='cancel_requested' AND NEW."status" IN ('canceled','outcome_unknown'))) THEN RAISE EXCEPTION 'bot_pr_transition'; END IF;
 IF NEW."status"='running' THEN
  IF OLD."attemptCount"<>0 OR NEW."attemptCount"<>1 OR OLD."cancelRequested" OR OLD."deadlineAt"<=clock_timestamp() OR NEW."leaseOwner" IS NULL OR NEW."leaseExpiresAt"<=NEW."updatedAt" OR NEW."leaseExpiresAt">NEW."updatedAt"+INTERVAL '50 seconds' THEN RAISE EXCEPTION 'bot_pr_claim'; END IF;
 ELSE
  IF NEW."attemptCount"<>OLD."attemptCount" THEN RAISE EXCEPTION 'bot_pr_attempt_immutable'; END IF;
  IF NEW."status"='cancel_requested' THEN
   IF NEW."leaseOwner" IS DISTINCT FROM OLD."leaseOwner" OR NEW."leaseExpiresAt" IS DISTINCT FROM OLD."leaseExpiresAt" THEN RAISE EXCEPTION 'bot_pr_lease_immutable'; END IF;
  ELSIF NEW."leaseOwner" IS NOT NULL OR NEW."leaseExpiresAt" IS NOT NULL THEN RAISE EXCEPTION 'bot_pr_terminal_lease'; END IF;
 END IF;
 IF NEW."status" IN ('canceled','cancel_requested') AND NOT NEW."cancelRequested" THEN RAISE EXCEPTION 'bot_pr_cancel_required'; END IF;
 IF NEW."status"='completed' AND (OLD."cancelRequested" OR NEW."cancelRequested" OR OLD."deadlineAt"<=clock_timestamp() OR OLD."leaseExpiresAt" IS NULL OR OLD."leaseExpiresAt"<=clock_timestamp()) THEN RAISE EXCEPTION 'bot_pr_late_completion'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "BotPullRequestEvidenceRun_state" BEFORE INSERT OR UPDATE OR DELETE ON "BotPullRequestEvidenceRun" FOR EACH ROW EXECUTE FUNCTION axiom_bot_pr_state_guard();
CREATE FUNCTION axiom_bot_pr_evidence_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE run_id TEXT; r "BotPullRequestEvidenceRun"%ROWTYPE; n INTEGER; last_seq INTEGER; last_type TEXT; artifacts INTEGER;
BEGIN
 IF TG_TABLE_NAME='BotPullRequestEvidenceRun' THEN run_id:=NEW."id"; ELSE run_id:=NEW."runId"; END IF;
 SELECT * INTO r FROM "BotPullRequestEvidenceRun" WHERE "id"=run_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'bot_pr_missing'; END IF;
 SELECT count(*),max("sequence") INTO n,last_seq FROM "BotPullRequestEvidenceEvent" WHERE "runId"=run_id;
 SELECT "eventType" INTO last_type FROM "BotPullRequestEvidenceEvent" WHERE "runId"=run_id ORDER BY "sequence" DESC LIMIT 1;
 IF n<>r."eventCount" OR last_seq<>n-1 OR last_type<>'run.'||r."status" THEN RAISE EXCEPTION 'bot_pr_event_integrity'; END IF;
 SELECT count(*) INTO artifacts FROM "BotPullRequestEvidenceArtifact" WHERE "runId"=run_id;
 IF (r."status"='completed' AND artifacts<>1) OR (r."status"<>'completed' AND artifacts<>0) THEN RAISE EXCEPTION 'bot_pr_artifact_integrity'; END IF;
 IF r."status"='completed' AND (r."attemptCount"<>1 OR r."deadlineAt"<=clock_timestamp()) THEN RAISE EXCEPTION 'bot_pr_commit_deadline'; END IF;
 IF EXISTS(SELECT 1 FROM "BotPullRequestEvidenceArtifact" WHERE "runId"=run_id AND ("snapshotDigest"<>r."snapshotDigest" OR "observedAt"<r."createdAt" OR "observedAt">r."updatedAt" OR "createdAt"<>r."updatedAt")) THEN RAISE EXCEPTION 'bot_pr_artifact_provenance'; END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER "BotPullRequestEvidenceRun_evidence" AFTER INSERT OR UPDATE ON "BotPullRequestEvidenceRun" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION axiom_bot_pr_evidence_guard();
CREATE CONSTRAINT TRIGGER "BotPullRequestEvidenceEvent_evidence" AFTER INSERT ON "BotPullRequestEvidenceEvent" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION axiom_bot_pr_evidence_guard();
CREATE CONSTRAINT TRIGGER "BotPullRequestEvidenceArtifact_evidence" AFTER INSERT ON "BotPullRequestEvidenceArtifact" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION axiom_bot_pr_evidence_guard();
