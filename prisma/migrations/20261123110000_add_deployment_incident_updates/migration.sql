CREATE TABLE "DeploymentIncidentUpdate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeploymentIncidentUpdate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeploymentIncidentUpdate_scope_read_idx"
    ON "DeploymentIncidentUpdate" ("organizationId", "incidentId", "releaseId", "createdAt", "id");
