-- Incident-response evidence record. status/severity are plain strings
-- validated at the application layer (lib/incident/incidentLifecycle.ts),
-- not Postgres enums, matching Release.status's convention.
CREATE TABLE "IncidentRecord" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'detected',
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "detectedByUserId" TEXT,
  "affectedOrganizationIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "mitigatedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "postmortemCompletedAt" TIMESTAMP(3),
  "postmortemUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IncidentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IncidentRecord_organizationId_status_idx" ON "IncidentRecord"("organizationId", "status");
CREATE INDEX "IncidentRecord_organizationId_detectedAt_idx" ON "IncidentRecord"("organizationId", "detectedAt");
