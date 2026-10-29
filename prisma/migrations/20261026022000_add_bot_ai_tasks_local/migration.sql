-- LOCAL AI task runtime only. No approval for production application or live inference.
CREATE TABLE "BotAiTaskRun" (
 "id" TEXT PRIMARY KEY CHECK ("id" ~ '^botai_[a-f0-9]{64}$'),
 "organizationId" TEXT NOT NULL,
 "createdByUserId" TEXT NOT NULL,
 "taskId" TEXT NOT NULL CHECK ("taskId" ~ '^bot_[a-f0-9]{64}$'),
 "taskVersion" INTEGER NOT NULL CHECK ("taskVersion">=0),
 "clientRequestId" TEXT NOT NULL,
 "kind" TEXT NOT NULL CHECK ("kind"='ai_task_response_v1'),
 "modelId" TEXT NOT NULL,
 "correlationId" TEXT NOT NULL,
 "dispatchClaimedAt" TIMESTAMP(3),
 "usageReceiptId" TEXT,
 "intentHash" TEXT NOT NULL CHECK ("intentHash" ~ '^[a-f0-9]{64}$'),
 "snapshotJson" JSONB NOT NULL CHECK (octet_length("snapshotJson"::text)<=22000),
 "snapshotDigest" TEXT NOT NULL CHECK ("snapshotDigest" ~ '^[a-f0-9]{64}$'),
 "status" TEXT NOT NULL DEFAULT 'queued' CHECK ("status" IN ('queued','preparing','dispatching','needs_input','completed','failed','cancel_requested','canceled','outcome_unknown')),
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
 CONSTRAINT "BotAiTaskRun_deadline_bound" CHECK ("deadlineAt"="createdAt"+INTERVAL '60 seconds'),
 CONSTRAINT "BotAiTaskRun_lease_pair" CHECK (("leaseOwner" IS NULL)=("leaseExpiresAt" IS NULL))
);
CREATE UNIQUE INDEX "BotAiTaskRun_owner_id_key" ON "BotAiTaskRun"("organizationId","createdByUserId","id");
CREATE UNIQUE INDEX "BotAiTaskRun_owner_request_key" ON "BotAiTaskRun"("organizationId","createdByUserId","clientRequestId");
CREATE INDEX "BotAiTaskRun_owner_created_idx" ON "BotAiTaskRun"("organizationId","createdByUserId","createdAt","id");
CREATE TABLE "BotAiTaskEvent" (
 "id" TEXT PRIMARY KEY,
 "organizationId" TEXT NOT NULL,
 "createdByUserId" TEXT NOT NULL,
 "runId" TEXT NOT NULL,
 "sequence" INTEGER NOT NULL CHECK ("sequence" BETWEEN 0 AND 19),
 "eventType" TEXT NOT NULL CHECK ("eventType" IN ('run.queued','run.preparing','run.dispatching','run.completed','run.failed','run.cancel_requested','run.canceled','run.needs_input','run.outcome_unknown')),
 "payloadJson" JSONB NOT NULL CHECK (octet_length("payloadJson"::text)<=4096),
 "occurredAt" TIMESTAMP(3) NOT NULL,
 FOREIGN KEY ("organizationId","createdByUserId","runId") REFERENCES "BotAiTaskRun"("organizationId","createdByUserId","id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "BotAiTaskEvent_run_sequence_key" ON "BotAiTaskEvent"("runId","sequence");
CREATE INDEX "BotAiTaskEvent_owner_run_sequence_idx" ON "BotAiTaskEvent"("organizationId","createdByUserId","runId","sequence");
CREATE TABLE "BotAiTaskArtifact" (
 "id" TEXT PRIMARY KEY,
 "organizationId" TEXT NOT NULL,
 "createdByUserId" TEXT NOT NULL,
 "runId" TEXT NOT NULL UNIQUE,
 "kind" TEXT NOT NULL CHECK ("kind" IN ('ai_task_answer','ai_task_clarification')),
 "content" TEXT NOT NULL CHECK (octet_length("content")<=32768),
 "contentHash" TEXT NOT NULL CHECK ("contentHash" ~ '^[a-f0-9]{64}$'),
 "snapshotDigest" TEXT NOT NULL CHECK ("snapshotDigest" ~ '^[a-f0-9]{64}$'),
 "usageReceiptId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL,
 FOREIGN KEY ("organizationId","createdByUserId","runId") REFERENCES "BotAiTaskRun"("organizationId","createdByUserId","id") ON DELETE RESTRICT
);
CREATE INDEX "BotAiTaskArtifact_owner_run_idx" ON "BotAiTaskArtifact"("organizationId","createdByUserId","runId");
CREATE FUNCTION axiom_bot_ai_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'bot_run_evidence_immutable'; END;
$$;
CREATE TRIGGER "BotAiTaskEvent_immutable" BEFORE UPDATE OR DELETE ON "BotAiTaskEvent" FOR EACH ROW EXECUTE FUNCTION axiom_bot_ai_append_only();
CREATE TRIGGER "BotAiTaskArtifact_immutable" BEFORE UPDATE OR DELETE ON "BotAiTaskArtifact" FOR EACH ROW EXECUTE FUNCTION axiom_bot_ai_append_only();
CREATE FUNCTION axiom_bot_ai_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'ai_task_identity_immutable'; END IF;
 IF ROW(NEW."id",NEW."organizationId",NEW."createdByUserId",NEW."taskId",NEW."taskVersion",NEW."clientRequestId",NEW."kind",NEW."modelId",NEW."correlationId",NEW."intentHash",NEW."snapshotJson",NEW."snapshotDigest",NEW."createdAt",NEW."deadlineAt") IS DISTINCT FROM ROW(OLD."id",OLD."organizationId",OLD."createdByUserId",OLD."taskId",OLD."taskVersion",OLD."clientRequestId",OLD."kind",OLD."modelId",OLD."correlationId",OLD."intentHash",OLD."snapshotJson",OLD."snapshotDigest",OLD."createdAt",OLD."deadlineAt") THEN RAISE EXCEPTION 'ai_task_identity_immutable'; END IF;
 IF OLD."status" IN ('needs_input','completed','failed','canceled','outcome_unknown') THEN RAISE EXCEPTION 'ai_task_terminal_immutable'; END IF;
 IF NEW."revision"<>OLD."revision"+1 OR NEW."eventCount"<>OLD."eventCount"+1 OR NEW."storedBytes"<OLD."storedBytes" OR (OLD."cancelRequested" AND NOT NEW."cancelRequested") THEN RAISE EXCEPTION 'ai_task_monotonic_state_required'; END IF;
 IF NOT (
  (OLD."status"='queued' AND NEW."status" IN ('preparing','canceled','failed')) OR
  (OLD."status"='preparing' AND NEW."status" IN ('dispatching','canceled','failed')) OR
  (OLD."status"='dispatching' AND NEW."status" IN ('completed','needs_input','cancel_requested','outcome_unknown')) OR
  (OLD."status"='cancel_requested' AND NEW."status"='outcome_unknown')
 ) THEN RAISE EXCEPTION 'ai_task_invalid_transition'; END IF;
 IF OLD."status"='preparing' AND NEW."status"='dispatching' THEN
  IF OLD."attemptCount"<>0 OR NEW."attemptCount"<>1 OR OLD."dispatchClaimedAt" IS NOT NULL OR NEW."dispatchClaimedAt" IS NULL OR OLD."cancelRequested" OR OLD."deadlineAt"<=clock_timestamp() OR OLD."leaseExpiresAt" IS NULL OR OLD."leaseExpiresAt"<=clock_timestamp() OR NEW."leaseOwner" IS DISTINCT FROM OLD."leaseOwner" OR NEW."leaseExpiresAt" IS DISTINCT FROM OLD."leaseExpiresAt" THEN RAISE EXCEPTION 'ai_task_invalid_dispatch'; END IF;
 ELSE
  IF NEW."attemptCount"<>OLD."attemptCount" OR NEW."dispatchClaimedAt" IS DISTINCT FROM OLD."dispatchClaimedAt" THEN RAISE EXCEPTION 'ai_task_dispatch_immutable'; END IF;
 END IF;
 IF NEW."status" IN ('preparing','dispatching','cancel_requested') THEN
  IF NEW."leaseOwner" IS NULL OR NEW."leaseExpiresAt" IS NULL OR NEW."leaseExpiresAt">NEW."updatedAt"+INTERVAL '90 seconds' THEN RAISE EXCEPTION 'ai_task_invalid_lease'; END IF;
 ELSE
  IF NEW."leaseOwner" IS NOT NULL OR NEW."leaseExpiresAt" IS NOT NULL THEN RAISE EXCEPTION 'ai_task_terminal_lease'; END IF;
 END IF;
 IF NEW."status"='preparing' AND (OLD."deadlineAt"<=clock_timestamp() OR NEW."attemptCount"<>0) THEN RAISE EXCEPTION 'ai_task_invalid_preparation'; END IF;
 IF NEW."status" IN ('canceled','cancel_requested') AND NOT NEW."cancelRequested" THEN RAISE EXCEPTION 'ai_task_cancellation_required'; END IF;
 IF NEW."status" IN ('completed','needs_input') THEN
  IF OLD."cancelRequested" OR NEW."cancelRequested" OR OLD."deadlineAt"<=clock_timestamp() OR OLD."leaseExpiresAt" IS NULL OR OLD."leaseExpiresAt"<=clock_timestamp() OR NEW."usageReceiptId" IS NULL OR length(NEW."usageReceiptId")=0 THEN RAISE EXCEPTION 'ai_task_unverified_or_late_completion'; END IF;
 ELSIF NEW."usageReceiptId" IS DISTINCT FROM OLD."usageReceiptId" THEN RAISE EXCEPTION 'ai_task_receipt_immutable'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER "BotAiTaskRun_identity_guard" BEFORE UPDATE OR DELETE ON "BotAiTaskRun" FOR EACH ROW EXECUTE FUNCTION axiom_bot_ai_identity_guard();
CREATE FUNCTION axiom_bot_ai_initial_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."status"<>'queued' OR NEW."attemptCount"<>0 OR NEW."revision"<>0 OR NEW."eventCount"<>1 OR NEW."cancelRequested" OR NEW."dispatchClaimedAt" IS NOT NULL OR NEW."usageReceiptId" IS NOT NULL OR NEW."leaseOwner" IS NOT NULL OR NEW."leaseExpiresAt" IS NOT NULL THEN RAISE EXCEPTION 'ai_task_initial_state_required'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER "BotAiTaskRun_initial_guard" BEFORE INSERT ON "BotAiTaskRun" FOR EACH ROW EXECUTE FUNCTION axiom_bot_ai_initial_guard();
CREATE FUNCTION axiom_bot_ai_evidence_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE run_id TEXT; current_run "BotAiTaskRun"%ROWTYPE; n INTEGER; max_seq INTEGER; latest_type TEXT; artifacts INTEGER;
BEGIN
 IF TG_TABLE_NAME='BotAiTaskRun' THEN run_id:=NEW."id"; ELSE run_id:=NEW."runId"; END IF;
 SELECT * INTO current_run FROM "BotAiTaskRun" WHERE "id"=run_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'ai_task_missing'; END IF;
 SELECT count(*),max("sequence") INTO n,max_seq FROM "BotAiTaskEvent" WHERE "runId"=run_id;
 SELECT "eventType" INTO latest_type FROM "BotAiTaskEvent" WHERE "runId"=run_id ORDER BY "sequence" DESC LIMIT 1;
 IF n<>current_run."eventCount" OR max_seq<>n-1 OR latest_type<>'run.'||current_run."status" THEN RAISE EXCEPTION 'ai_task_event_integrity'; END IF;
 IF current_run."status" IN ('completed','needs_input') AND (current_run."deadlineAt"<=clock_timestamp() OR current_run."dispatchClaimedAt" IS NULL OR current_run."attemptCount"<>1) THEN RAISE EXCEPTION 'ai_task_commit_deadline_or_dispatch'; END IF;
 SELECT count(*) INTO artifacts FROM "BotAiTaskArtifact" WHERE "runId"=run_id;
 IF (current_run."status" IN ('completed','needs_input') AND artifacts<>1) OR (current_run."status" NOT IN ('completed','needs_input') AND artifacts<>0) THEN RAISE EXCEPTION 'ai_task_artifact_integrity'; END IF;
 IF EXISTS (SELECT 1 FROM "BotAiTaskArtifact" WHERE "runId"=run_id AND ("snapshotDigest"<>current_run."snapshotDigest" OR "usageReceiptId" IS DISTINCT FROM current_run."usageReceiptId" OR "createdAt"<current_run."createdAt" OR "createdAt">current_run."updatedAt" OR (current_run."status"='completed' AND "kind"<>'ai_task_answer') OR (current_run."status"='needs_input' AND "kind"<>'ai_task_clarification'))) THEN RAISE EXCEPTION 'ai_task_artifact_provenance'; END IF;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "BotAiTaskRun_evidence" AFTER INSERT OR UPDATE ON "BotAiTaskRun" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION axiom_bot_ai_evidence_guard();
CREATE CONSTRAINT TRIGGER "BotAiTaskEvent_evidence" AFTER INSERT ON "BotAiTaskEvent" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION axiom_bot_ai_evidence_guard();
CREATE CONSTRAINT TRIGGER "BotAiTaskArtifact_evidence" AFTER INSERT ON "BotAiTaskArtifact" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION axiom_bot_ai_evidence_guard();
