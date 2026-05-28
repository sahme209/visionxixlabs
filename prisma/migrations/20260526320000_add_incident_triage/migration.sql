-- Phase 509 — IncidentTriage scaffold.

-- CreateTable
CREATE TABLE "IncidentTriage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "suggestedOwnerTeam" TEXT NOT NULL,
    "estimatedTimeToMitigateMinutes" INTEGER NOT NULL,
    "recommendedRunbook" TEXT,
    "autoEscalate" BOOLEAN NOT NULL DEFAULT false,
    "confidence" INTEGER NOT NULL,
    "rationale" TEXT NOT NULL,
    "inputsJson" JSONB NOT NULL,
    "operatorDecision" TEXT NOT NULL DEFAULT 'pending',
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "overridePriority" TEXT,
    "engineVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidentTriage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncidentTriage_organizationId_operatorDecision_idx" ON "IncidentTriage"("organizationId", "operatorDecision");

-- CreateIndex
CREATE INDEX "IncidentTriage_organizationId_incidentId_idx" ON "IncidentTriage"("organizationId", "incidentId");

-- CreateIndex
CREATE INDEX "IncidentTriage_organizationId_priority_idx" ON "IncidentTriage"("organizationId", "priority");
