-- CreateTable
CREATE TABLE "DeploymentIncidentAssignment" (
    "incidentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentIncidentAssignment_pkey" PRIMARY KEY ("incidentId")
);

-- AddForeignKey
ALTER TABLE "DeploymentIncidentAssignment" ADD CONSTRAINT "DeploymentIncidentAssignment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "DeploymentIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
