-- Change passport: where an agent-proposed change came from (agent, model, tools, owner).
-- Additive, nullable: existing rows are unchanged and read as "no passport recorded".
ALTER TABLE "AgentActionProposal" ADD COLUMN "passport" JSONB;
ALTER TABLE "AgentGatewayRequest" ADD COLUMN "passport" JSONB;
