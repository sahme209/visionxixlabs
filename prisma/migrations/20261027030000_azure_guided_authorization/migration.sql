CREATE TABLE "AzureGuidedAuthorization" (
 "id" TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"userId" TEXT NOT NULL,"sessionId" TEXT NOT NULL,
 "kind" TEXT NOT NULL DEFAULT 'authorization',"stateDigest" TEXT NOT NULL,"nonceDigest" TEXT NOT NULL,"configurationDigest" TEXT NOT NULL,
 "encryptedVerifier" TEXT NOT NULL,"encryptedTokens" TEXT,"resourcesJson" JSONB,"status" TEXT NOT NULL,"version" INTEGER NOT NULL DEFAULT 0,
 "operationExpiresAt" TIMESTAMP(3),"expiresAt" TIMESTAMP(3) NOT NULL,"connectionId" TEXT,"connectionVersion" INTEGER,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "AzureGuidedAuthorization_bounded" CHECK ("version">=0 AND "kind" IN ('authorization','refresh') AND "status" IN ('awaiting_consent','exchanging','selection_required','verifying','connected_read_only','outcome_unknown','cancelled','refreshing') AND length("stateDigest")=64 AND length("nonceDigest")=64 AND length("configurationDigest")=64 AND octet_length("encryptedVerifier")<=32768 AND ("encryptedTokens" IS NULL OR octet_length("encryptedTokens")<=131072) AND ("resourcesJson" IS NULL OR octet_length("resourcesJson"::text)<=32768))
);
CREATE UNIQUE INDEX "AzureGuidedAuthorization_stateDigest_key" ON "AzureGuidedAuthorization"("stateDigest");
CREATE INDEX "AzureGuidedAuthorization_organizationId_userId_sessionId_createdAt_idx" ON "AzureGuidedAuthorization"("organizationId","userId","sessionId","createdAt");
CREATE INDEX "AzureGuidedAuthorization_connectionId_connectionVersion_idx" ON "AzureGuidedAuthorization"("connectionId","connectionVersion");
CREATE UNIQUE INDEX "AzureGuidedAuthorization_one_refresh_revision" ON "AzureGuidedAuthorization"("connectionId","connectionVersion") WHERE "kind"='refresh';
CREATE FUNCTION axiom_azure_guided_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF ROW(NEW."id",NEW."organizationId",NEW."userId",NEW."sessionId",NEW."kind",NEW."stateDigest",NEW."nonceDigest",NEW."configurationDigest",NEW."expiresAt",NEW."createdAt") IS DISTINCT FROM ROW(OLD."id",OLD."organizationId",OLD."userId",OLD."sessionId",OLD."kind",OLD."stateDigest",OLD."nonceDigest",OLD."configurationDigest",OLD."expiresAt",OLD."createdAt") THEN RAISE EXCEPTION 'azure_guided_identity_immutable'; END IF;
 IF NEW."version"<>OLD."version"+1 THEN RAISE EXCEPTION 'azure_guided_version_required'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "AzureGuidedAuthorization_identity_guard" BEFORE UPDATE ON "AzureGuidedAuthorization" FOR EACH ROW EXECUTE FUNCTION axiom_azure_guided_identity_guard();
