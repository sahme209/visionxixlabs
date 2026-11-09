-- Agent governance gateway (A10). Additive only: one new table, two indexes.
CREATE TABLE IF NOT EXISTS "AgentGatewayRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "actionKind" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "policyDecision" TEXT NOT NULL,
    "policyReasons" JSONB NOT NULL,
    "actionDigest" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "outcome" TEXT,
    "outcomeDetail" TEXT,
    "outcomeAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentGatewayRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AgentGatewayRequest_organizationId_status_createdAt_idx" ON "AgentGatewayRequest"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentGatewayRequest_apiKeyId_createdAt_idx" ON "AgentGatewayRequest"("apiKeyId", "createdAt");
