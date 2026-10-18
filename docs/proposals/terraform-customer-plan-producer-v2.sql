-- REVIEW PROPOSAL ONLY. Never executed automatically or against a configured DB.
-- Requires the existing v1 artifact proposal and canonical parent tables.
BEGIN;
CREATE TABLE "TerraformCustomerPlanFeature" (
 "version" integer CONSTRAINT tfcp_feature_pk PRIMARY KEY CONSTRAINT tfcp_feature_version CHECK ("version"=2),
 "proposalChecksum" text NOT NULL CONSTRAINT tfcp_feature_checksum CHECK ("proposalChecksum" ~ '^[a-f0-9]{64}$')
);
CREATE TABLE "TerraformCustomerPlanProfile" (
 "id" text NOT NULL, "revision" integer NOT NULL CONSTRAINT tfcp_profile_revision CHECK ("revision">0),
 "organizationId" text NOT NULL, "deploymentRequestId" text NOT NULL, "requestVersion" integer NOT NULL CONSTRAINT tfcp_profile_version CHECK ("requestVersion">0),
 "environmentId" text NOT NULL, "profileJson" jsonb NOT NULL, "profileDigest" text NOT NULL CONSTRAINT tfcp_profile_digest CHECK ("profileDigest" ~ '^[a-f0-9]{64}$'),
 "actorUserId" text NOT NULL, "createdAt" timestamp(3) NOT NULL,
 CONSTRAINT tfcp_profile_pk PRIMARY KEY ("id","revision"),
 CONSTRAINT tfcp_profile_scope UNIQUE ("id","revision","organizationId","deploymentRequestId"),
 CONSTRAINT tfcp_profile_request FOREIGN KEY ("deploymentRequestId") REFERENCES "TauriDeploymentRequest"("id"),
 CONSTRAINT tfcp_profile_environment FOREIGN KEY ("environmentId") REFERENCES "Environment"("id")
);
CREATE TABLE "TerraformCustomerPlanCurrent" (
 "id" text CONSTRAINT tfcp_current_pk PRIMARY KEY, "revision" integer NOT NULL CONSTRAINT tfcp_current_revision CHECK ("revision">0),
 "organizationId" text NOT NULL, "deploymentRequestId" text NOT NULL, "environmentId" text NOT NULL,
 "status" text NOT NULL CONSTRAINT tfcp_current_status CHECK ("status" IN ('active','revoked')), "updatedAt" timestamp(3) NOT NULL,
 CONSTRAINT tfcp_current_scope UNIQUE ("organizationId","deploymentRequestId"),
 CONSTRAINT tfcp_current_profile FOREIGN KEY ("id","revision","organizationId","deploymentRequestId") REFERENCES "TerraformCustomerPlanProfile"("id","revision","organizationId","deploymentRequestId")
);
CREATE TABLE "TerraformCustomerPlanProvenance" (
 "artifactId" text CONSTRAINT tfcp_provenance_pk PRIMARY KEY,
 "organizationId" text NOT NULL, "deploymentRequestId" text NOT NULL, "requestVersion" integer NOT NULL CONSTRAINT tfcp_provenance_version CHECK ("requestVersion">0),
 "profileId" text NOT NULL, "profileRevision" integer NOT NULL,
 "bindingDigest" text NOT NULL CONSTRAINT tfcp_provenance_binding CHECK ("bindingDigest" ~ '^[a-f0-9]{64}$'),
 "binaryDigest" text NOT NULL CONSTRAINT tfcp_provenance_binary CHECK ("binaryDigest" ~ '^[a-f0-9]{64}$'),
 "showDigest" text NOT NULL CONSTRAINT tfcp_provenance_show CHECK ("showDigest" ~ '^[a-f0-9]{64}$'),
 "receiptDigest" text NOT NULL CONSTRAINT tfcp_provenance_receipt CHECK ("receiptDigest" ~ '^[a-f0-9]{64}$'),
 "attestationDigest" text NOT NULL CONSTRAINT tfcp_provenance_attestation CHECK ("attestationDigest" ~ '^sha256:[a-f0-9]{64}$'),
 "trustDigest" text NOT NULL CONSTRAINT tfcp_provenance_trust CHECK ("trustDigest" ~ '^[a-f0-9]{64}$'),
 "encryptedProof" text NOT NULL, "createdAt" timestamp(3) NOT NULL,
 CONSTRAINT tfcp_provenance_artifact FOREIGN KEY ("artifactId") REFERENCES "TerraformSavedPlanArtifact"("id"),
 CONSTRAINT tfcp_provenance_profile FOREIGN KEY ("profileId","profileRevision","organizationId","deploymentRequestId") REFERENCES "TerraformCustomerPlanProfile"("id","revision","organizationId","deploymentRequestId")
);
CREATE FUNCTION axiom_customer_plan_profile_guard_v2() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'customer_plan_profile_immutable'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "TauriDeploymentRequest" r JOIN "TauriDeploymentRequestVersion" v ON v."deploymentRequestId"=r."id" AND v."organizationId"=r."organizationId" AND v."version"=NEW."requestVersion"
  JOIN "Environment" e ON e."id"=NEW."environmentId" AND e."organizationId"=r."organizationId"
  WHERE r."id"=NEW."deploymentRequestId" AND r."organizationId"=NEW."organizationId") OR
  NEW."profileJson"->>'schema' IS DISTINCT FROM 'axiom.terraform.customer-profile.v2' OR
  NEW."profileJson"->>'id' IS DISTINCT FROM NEW."id" OR NEW."profileJson"->>'organizationId' IS DISTINCT FROM NEW."organizationId" OR
  NEW."profileJson"->>'deploymentRequestId' IS DISTINCT FROM NEW."deploymentRequestId" OR NEW."profileJson"->>'environmentId' IS DISTINCT FROM NEW."environmentId" OR
  NEW."profileJson"->>'revision' IS DISTINCT FROM NEW."revision"::text OR NEW."profileJson"->>'requestVersion' IS DISTINCT FROM NEW."requestVersion"::text THEN
  RAISE EXCEPTION 'customer_plan_profile_scope_mismatch';
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION axiom_customer_plan_current_guard_v2() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'customer_plan_current_delete_forbidden'; END IF;
 IF (TG_OP='INSERT' AND NEW."revision"<>1) OR (TG_OP='UPDATE' AND
  (NEW."id"<>OLD."id" OR NEW."organizationId"<>OLD."organizationId" OR NEW."deploymentRequestId"<>OLD."deploymentRequestId" OR NEW."environmentId"<>OLD."environmentId" OR NEW."revision"<>OLD."revision"+1)) THEN
  RAISE EXCEPTION 'customer_plan_current_revision_conflict';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM "TerraformCustomerPlanProfile" p WHERE p."id"=NEW."id" AND p."revision"=NEW."revision" AND p."organizationId"=NEW."organizationId" AND p."deploymentRequestId"=NEW."deploymentRequestId" AND p."environmentId"=NEW."environmentId") THEN
  RAISE EXCEPTION 'customer_plan_current_scope_mismatch';
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION axiom_customer_plan_provenance_guard_v2() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'customer_plan_provenance_immutable'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "TerraformSavedPlanArtifact" a JOIN "TauriDeploymentRequest" r ON r."id"=a."deploymentRequestId" AND r."organizationId"=a."organizationId" AND r."version"=a."requestVersion"
  JOIN "TerraformCustomerPlanCurrent" c ON c."id"=NEW."profileId" AND c."revision"=NEW."profileRevision" AND c."organizationId"=NEW."organizationId" AND c."deploymentRequestId"=NEW."deploymentRequestId" AND c."status"='active'
  WHERE a."id"=NEW."artifactId" AND a."organizationId"=NEW."organizationId" AND a."deploymentRequestId"=NEW."deploymentRequestId" AND a."requestVersion"=NEW."requestVersion"
  AND a."bindingJson"->>'schema'='axiom.terraform.saved-plan.v2' AND a."bindingDigest"=NEW."bindingDigest" AND a."binaryDigest"=NEW."binaryDigest" AND a."showDigest"=NEW."showDigest"
  AND a."bindingJson"->'profile'->>'id'=NEW."profileId" AND a."bindingJson"->'profile'->>'revision'=NEW."profileRevision"::text
  AND a."bindingJson"->'producer'->>'receiptDigest'=NEW."receiptDigest" AND a."bindingJson"->'producer'->>'attestationDigest'=NEW."attestationDigest" AND a."bindingJson"->'producer'->>'trustDigest'=NEW."trustDigest") THEN
  RAISE EXCEPTION 'customer_plan_provenance_scope_mismatch';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER axiom_customer_plan_profile_guard_v2 BEFORE INSERT OR UPDATE OR DELETE ON "TerraformCustomerPlanProfile" FOR EACH ROW EXECUTE FUNCTION axiom_customer_plan_profile_guard_v2();
CREATE TRIGGER axiom_customer_plan_current_guard_v2 BEFORE INSERT OR UPDATE OR DELETE ON "TerraformCustomerPlanCurrent" FOR EACH ROW EXECUTE FUNCTION axiom_customer_plan_current_guard_v2();
CREATE TRIGGER axiom_customer_plan_provenance_guard_v2 BEFORE INSERT OR UPDATE OR DELETE ON "TerraformCustomerPlanProvenance" FOR EACH ROW EXECUTE FUNCTION axiom_customer_plan_provenance_guard_v2();
-- Separately reviewed installer records exact SQL checksum only after rollback/catalog acceptance.
-- This proposal intentionally installs no marker and is outside Prisma migrations.
COMMIT;
