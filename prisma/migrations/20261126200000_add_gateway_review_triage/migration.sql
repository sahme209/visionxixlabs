-- Automatic review triage by blast radius on agent gateway requests, with a second approver for the
-- two_person lane. Additive and nullable: existing requests keep single-approval behaviour.
ALTER TABLE "AgentGatewayRequest" ADD COLUMN "reviewTriage" JSONB;
ALTER TABLE "AgentGatewayRequest" ADD COLUMN "firstApproverUserId" TEXT;
ALTER TABLE "AgentGatewayRequest" ADD COLUMN "firstApprovedAt" TIMESTAMP(3);
