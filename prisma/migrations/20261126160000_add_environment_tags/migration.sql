-- Additive only: key:value tags on environments for tenant fan-out planning.
ALTER TABLE "Environment" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
