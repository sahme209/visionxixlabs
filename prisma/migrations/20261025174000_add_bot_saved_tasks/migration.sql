-- Additive saved drafts only. Apply independently after review; no recovered schema SQL.
CREATE TABLE "BotTaskDraft" (
 "id" TEXT PRIMARY KEY,
 "organizationId" TEXT NOT NULL,
 "createdByUserId" TEXT NOT NULL,
 "clientRequestId" TEXT NOT NULL,
 "title" VARCHAR(200) NOT NULL,
 "instruction" TEXT NOT NULL,
 "context" TEXT NOT NULL,
 "initialContentHash" TEXT NOT NULL,
 "contentHash" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'draft' CHECK ("status" = 'draft'),
 "version" INTEGER NOT NULL DEFAULT 0 CHECK ("version" >= 0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "BotTaskDraft_content_bounds" CHECK (
   length(btrim("title")) > 0 AND length(btrim("instruction")) > 0
   AND length("instruction") <= 4000 AND length("context") <= 4000
   AND octet_length("title") + octet_length("instruction") + octet_length("context") <= 16384),
 CONSTRAINT "BotTaskDraft_hashes" CHECK ("initialContentHash" ~ '^[a-f0-9]{64}$' AND "contentHash" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "BotTaskDraft_organizationId_id_key" ON "BotTaskDraft"("organizationId", "id");
CREATE UNIQUE INDEX "BotTaskDraft_organizationId_createdByUserId_clientRequestId_key" ON "BotTaskDraft"("organizationId", "createdByUserId", "clientRequestId");
CREATE INDEX "BotTaskDraft_organizationId_createdByUserId_createdAt_id_idx" ON "BotTaskDraft"("organizationId", "createdByUserId", "createdAt", "id");
CREATE TABLE "BotTaskDraftEvent" (
 "id" TEXT PRIMARY KEY,
 "organizationId" TEXT NOT NULL,
 "taskId" TEXT NOT NULL,
 "actorUserId" TEXT NOT NULL,
 "version" INTEGER NOT NULL CHECK ("version" >= 0),
 "eventType" TEXT NOT NULL CHECK ("eventType" IN ('draft.created', 'draft.updated')),
 "contentJson" JSONB NOT NULL,
 "contentHash" TEXT NOT NULL CHECK ("contentHash" ~ '^[a-f0-9]{64}$'),
 "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "BotTaskDraftEvent_organizationId_taskId_fkey" FOREIGN KEY ("organizationId", "taskId") REFERENCES "BotTaskDraft"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BotTaskDraftEvent_taskId_version_key" ON "BotTaskDraftEvent"("taskId", "version");
CREATE INDEX "BotTaskDraftEvent_organizationId_taskId_version_idx" ON "BotTaskDraftEvent"("organizationId", "taskId", "version");
CREATE FUNCTION axiom_bot_task_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'bot_task_history_immutable'; END;
$$;
CREATE TRIGGER "BotTaskDraftEvent_immutable" BEFORE UPDATE OR DELETE ON "BotTaskDraftEvent" FOR EACH ROW EXECUTE FUNCTION axiom_bot_task_history_immutable();
CREATE FUNCTION axiom_bot_task_identity_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW."id",NEW."organizationId",NEW."createdByUserId",NEW."clientRequestId",NEW."initialContentHash",NEW."createdAt") IS DISTINCT FROM ROW(OLD."id",OLD."organizationId",OLD."createdByUserId",OLD."clientRequestId",OLD."initialContentHash",OLD."createdAt") THEN
  RAISE EXCEPTION 'bot_task_identity_immutable';
 END IF;
 IF NEW."version" <> OLD."version" + 1 THEN RAISE EXCEPTION 'bot_task_version_must_advance'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER "BotTaskDraft_identity_immutable" BEFORE UPDATE ON "BotTaskDraft" FOR EACH ROW EXECUTE FUNCTION axiom_bot_task_identity_immutable();
