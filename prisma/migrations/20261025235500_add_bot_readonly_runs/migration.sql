-- New local report runtime only. Not approved for production application.
CREATE TABLE "BotTaskRun" (
 "id" TEXT PRIMARY KEY CHECK ("id" ~ '^botrun_[a-f0-9]{64}$'),
 "organizationId" TEXT NOT NULL,
 "createdByUserId" TEXT NOT NULL,
 "taskId" TEXT NOT NULL CHECK ("taskId" ~ '^bot_[a-f0-9]{64}$'),
 "taskVersion" INTEGER NOT NULL CHECK ("taskVersion">=0),
 "clientRequestId" TEXT NOT NULL,
 "adapter" TEXT NOT NULL CHECK ("adapter"='workspace_readiness_v1'),
 "intentHash" TEXT NOT NULL CHECK ("intentHash" ~ '^[a-f0-9]{64}$'),
 "snapshotJson" JSONB NOT NULL CHECK (octet_length("snapshotJson"::text)<=18000),
 "snapshotDigest" TEXT NOT NULL CHECK ("snapshotDigest" ~ '^[a-f0-9]{64}$'),
 "status" TEXT NOT NULL DEFAULT 'queued' CHECK ("status" IN ('queued','running','needs_attention','completed','failed','cancel_requested','canceled','outcome_unknown')),
 "revision" INTEGER NOT NULL DEFAULT 0 CHECK ("revision">=0),
 "attemptCount" INTEGER NOT NULL DEFAULT 0 CHECK ("attemptCount" BETWEEN 0 AND 1),
 "eventCount" INTEGER NOT NULL CHECK ("eventCount" BETWEEN 1 AND 20),
 "storedBytes" INTEGER NOT NULL CHECK ("storedBytes" BETWEEN 0 AND 131072),
 "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
 "leaseOwner" TEXT,
 "leaseExpiresAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 "deadlineAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "BotTaskRun_deadline_bound" CHECK ("deadlineAt"="createdAt"+INTERVAL '30 seconds'),
 CONSTRAINT "BotTaskRun_lease_pair" CHECK (("leaseOwner" IS NULL)=("leaseExpiresAt" IS NULL))
);
CREATE UNIQUE INDEX "BotTaskRun_owner_id_key" ON "BotTaskRun"("organizationId","createdByUserId","id");
CREATE UNIQUE INDEX "BotTaskRun_owner_request_key" ON "BotTaskRun"("organizationId","createdByUserId","clientRequestId");
CREATE INDEX "BotTaskRun_owner_created_idx" ON "BotTaskRun"("organizationId","createdByUserId","createdAt","id");
CREATE TABLE "BotTaskRunEvent" (
 "id" TEXT PRIMARY KEY,
 "organizationId" TEXT NOT NULL,
 "createdByUserId" TEXT NOT NULL,
 "runId" TEXT NOT NULL,
 "sequence" INTEGER NOT NULL CHECK ("sequence" BETWEEN 0 AND 19),
 "eventType" TEXT NOT NULL CHECK ("eventType" IN ('run.queued','run.running','run.completed','run.failed','run.cancel_requested','run.canceled','run.needs_attention','run.outcome_unknown')),
 "payloadJson" JSONB NOT NULL CHECK (octet_length("payloadJson"::text)<=4096),
 "occurredAt" TIMESTAMP(3) NOT NULL,
 FOREIGN KEY ("organizationId","createdByUserId","runId") REFERENCES "BotTaskRun"("organizationId","createdByUserId","id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "BotTaskRunEvent_run_sequence_key" ON "BotTaskRunEvent"("runId","sequence");
CREATE INDEX "BotTaskRunEvent_owner_run_sequence_idx" ON "BotTaskRunEvent"("organizationId","createdByUserId","runId","sequence");
CREATE TABLE "BotTaskArtifact" (
 "id" TEXT PRIMARY KEY,
 "organizationId" TEXT NOT NULL,
 "createdByUserId" TEXT NOT NULL,
 "runId" TEXT NOT NULL UNIQUE,
 "kind" TEXT NOT NULL CHECK ("kind"='workspace_readiness_report'),
 "content" TEXT NOT NULL CHECK (octet_length("content")<=32768),
 "contentHash" TEXT NOT NULL CHECK ("contentHash" ~ '^[a-f0-9]{64}$'),
 "snapshotDigest" TEXT NOT NULL CHECK ("snapshotDigest" ~ '^[a-f0-9]{64}$'),
 "observedAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL,
 FOREIGN KEY ("organizationId","createdByUserId","runId") REFERENCES "BotTaskRun"("organizationId","createdByUserId","id") ON DELETE RESTRICT
);
CREATE INDEX "BotTaskArtifact_owner_run_idx" ON "BotTaskArtifact"("organizationId","createdByUserId","runId");
CREATE FUNCTION axiom_bot_run_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'bot_run_evidence_immutable'; END;
$$;
CREATE TRIGGER "BotTaskRunEvent_immutable" BEFORE UPDATE OR DELETE ON "BotTaskRunEvent" FOR EACH ROW EXECUTE FUNCTION axiom_bot_run_append_only();
CREATE TRIGGER "BotTaskArtifact_immutable" BEFORE UPDATE OR DELETE ON "BotTaskArtifact" FOR EACH ROW EXECUTE FUNCTION axiom_bot_run_append_only();
CREATE FUNCTION axiom_bot_run_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'bot_run_identity_immutable'; END IF;
 IF ROW(NEW."id",NEW."organizationId",NEW."createdByUserId",NEW."taskId",NEW."taskVersion",NEW."clientRequestId",NEW."adapter",NEW."intentHash",NEW."snapshotJson",NEW."snapshotDigest",NEW."createdAt",NEW."deadlineAt") IS DISTINCT FROM ROW(OLD."id",OLD."organizationId",OLD."createdByUserId",OLD."taskId",OLD."taskVersion",OLD."clientRequestId",OLD."adapter",OLD."intentHash",OLD."snapshotJson",OLD."snapshotDigest",OLD."createdAt",OLD."deadlineAt") THEN RAISE EXCEPTION 'bot_run_identity_immutable'; END IF;
 IF OLD."status" IN ('needs_attention','completed','failed','canceled','outcome_unknown') THEN RAISE EXCEPTION 'bot_run_terminal_immutable'; END IF;
 IF NEW."revision"<>OLD."revision"+1 OR NEW."eventCount"<>OLD."eventCount"+1 OR NEW."attemptCount"<OLD."attemptCount" OR NEW."storedBytes"<OLD."storedBytes" OR (OLD."cancelRequested" AND NOT NEW."cancelRequested") THEN RAISE EXCEPTION 'bot_run_monotonic_state_required'; END IF;
 IF NOT (
  (OLD."status"='queued' AND NEW."status" IN ('running','canceled','needs_attention')) OR
  (OLD."status"='running' AND NEW."status" IN ('completed','failed','cancel_requested','outcome_unknown','needs_attention')) OR
  (OLD."status"='cancel_requested' AND NEW."status" IN ('canceled','failed','outcome_unknown','needs_attention'))
 ) THEN RAISE EXCEPTION 'bot_run_invalid_transition'; END IF;
 IF OLD."status"='queued' AND NEW."status"='running' THEN
  IF NEW."attemptCount"<>1 OR NEW."leaseOwner" IS NULL OR NEW."leaseExpiresAt" IS NULL OR NEW."cancelRequested" OR OLD."deadlineAt"<=clock_timestamp() THEN RAISE EXCEPTION 'bot_run_invalid_claim'; END IF;
 ELSIF NEW."attemptCount"<>OLD."attemptCount" THEN RAISE EXCEPTION 'bot_run_attempts_immutable'; END IF;
 IF NEW."status" IN ('running','cancel_requested') THEN
  IF NEW."leaseOwner" IS NULL OR NEW."leaseExpiresAt" IS NULL OR NEW."leaseExpiresAt">NEW."updatedAt"+INTERVAL '45 seconds' THEN RAISE EXCEPTION 'bot_run_invalid_lease'; END IF;
 ELSIF NEW."leaseOwner" IS NOT NULL OR NEW."leaseExpiresAt" IS NOT NULL THEN RAISE EXCEPTION 'bot_run_terminal_lease'; END IF;
 IF NEW."status" IN ('canceled','cancel_requested') AND NOT NEW."cancelRequested" THEN RAISE EXCEPTION 'bot_run_cancellation_required'; END IF;
 IF NEW."status"='completed' AND (OLD."cancelRequested" OR OLD."deadlineAt"<=clock_timestamp() OR OLD."leaseExpiresAt"<=clock_timestamp()) THEN RAISE EXCEPTION 'bot_run_late_completion'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER "BotTaskRun_identity_guard" BEFORE UPDATE OR DELETE ON "BotTaskRun" FOR EACH ROW EXECUTE FUNCTION axiom_bot_run_identity_guard();

-- Deferred integrity checks see the final atomic run/event/artifact state.
CREATE FUNCTION axiom_bot_run_evidence_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE run_id TEXT; current_run "BotTaskRun"%ROWTYPE; n INTEGER; max_seq INTEGER; latest_type TEXT; artifacts INTEGER;
BEGIN
 IF TG_TABLE_NAME='BotTaskRun' THEN run_id:=NEW."id"; ELSE run_id:=NEW."runId"; END IF;
 SELECT * INTO current_run FROM "BotTaskRun" WHERE "id"=run_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'bot_run_missing'; END IF;
 SELECT count(*),max("sequence") INTO n,max_seq FROM "BotTaskRunEvent" WHERE "runId"=run_id;
 SELECT "eventType" INTO latest_type FROM "BotTaskRunEvent" WHERE "runId"=run_id ORDER BY "sequence" DESC LIMIT 1;
 IF n<>current_run."eventCount" OR max_seq<>n-1 OR latest_type<>'run.'||current_run."status" THEN RAISE EXCEPTION 'bot_run_event_integrity'; END IF;
 IF current_run."status"='completed' AND current_run."deadlineAt"<=clock_timestamp() THEN RAISE EXCEPTION 'bot_run_commit_deadline_expired'; END IF;
 SELECT count(*) INTO artifacts FROM "BotTaskArtifact" WHERE "runId"=run_id;
 IF (current_run."status"='completed' AND artifacts<>1) OR (current_run."status"<>'completed' AND artifacts<>0) THEN RAISE EXCEPTION 'bot_run_artifact_integrity'; END IF;
 IF EXISTS (SELECT 1 FROM "BotTaskArtifact" WHERE "runId"=run_id AND ("snapshotDigest"<>current_run."snapshotDigest" OR "observedAt"<current_run."createdAt" OR "observedAt">"createdAt")) THEN RAISE EXCEPTION 'bot_run_artifact_provenance'; END IF;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "BotTaskRun_evidence" AFTER INSERT OR UPDATE ON "BotTaskRun" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION axiom_bot_run_evidence_guard();
CREATE CONSTRAINT TRIGGER "BotTaskRunEvent_evidence" AFTER INSERT ON "BotTaskRunEvent" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION axiom_bot_run_evidence_guard();
CREATE CONSTRAINT TRIGGER "BotTaskArtifact_evidence" AFTER INSERT ON "BotTaskArtifact" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION axiom_bot_run_evidence_guard();
