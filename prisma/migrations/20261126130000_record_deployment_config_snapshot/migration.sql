-- Additive only: configuration fingerprint recorded with each deployment.
ALTER TABLE "DeploymentExecution" ADD COLUMN "configDigest" TEXT;
ALTER TABLE "DeploymentExecution" ADD COLUMN "configSnapshot" JSONB;
