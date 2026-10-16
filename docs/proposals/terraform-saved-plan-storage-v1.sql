-- REVIEW PROPOSAL ONLY. Outside Prisma migration discovery. Never run against a
-- configured/customer database. Parent tables must already exist; no backlog.
BEGIN;
CREATE TABLE "TerraformSavedPlanFeature" (
  "version" integer PRIMARY KEY CHECK ("version" = 1),
  "proposalChecksum" text NOT NULL CHECK ("proposalChecksum" ~ '^[a-f0-9]{64}$')
);
CREATE TABLE "TerraformSavedPlanArtifact" (
  "id" text PRIMARY KEY,
  "organizationId" text NOT NULL,
  "deploymentRequestId" text NOT NULL REFERENCES "TauriDeploymentRequest"("id"),
  "requestVersion" integer NOT NULL CHECK ("requestVersion" > 0),
  "bindingJson" jsonb NOT NULL,
  "bindingDigest" text NOT NULL CHECK ("bindingDigest" ~ '^[a-f0-9]{64}$'),
  "binaryDigest" text NOT NULL CHECK ("binaryDigest" ~ '^[a-f0-9]{64}$'),
  "binaryBytes" integer NOT NULL CHECK ("binaryBytes" BETWEEN 1 AND 16777216),
  "showDigest" text NOT NULL CHECK ("showDigest" ~ '^[a-f0-9]{64}$'),
  "encryptedBinary" text NOT NULL,
  "encryptedShow" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL,
  "expiresAt" timestamp(3) NOT NULL CHECK ("expiresAt" > "createdAt"),
  UNIQUE ("organizationId", "deploymentRequestId", "requestVersion", "bindingDigest", "binaryDigest")
);
CREATE FUNCTION axiom_saved_plan_guard_v1() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'saved_plan_immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "TauriDeploymentRequest" r
    JOIN "TauriDeploymentRequestVersion" v ON v."deploymentRequestId"=r."id"
      AND v."organizationId"=r."organizationId" AND v."version"=NEW."requestVersion"
    WHERE r."id"=NEW."deploymentRequestId" AND r."organizationId"=NEW."organizationId"
      AND r."version"=NEW."requestVersion") THEN
    RAISE EXCEPTION 'saved_plan_tenant_request_version_mismatch';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER axiom_saved_plan_guard_v1 BEFORE INSERT OR UPDATE OR DELETE
  ON "TerraformSavedPlanArtifact" FOR EACH ROW EXECUTE FUNCTION axiom_saved_plan_guard_v1();
-- The separately reviewed installer records SHA256 of these exact SQL bytes in
-- TerraformSavedPlanFeature only after shape/checksum and rollback acceptance.
-- No marker is silently installed by runtime reads or this proposal itself.
COMMIT;
