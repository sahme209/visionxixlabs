-- Adds "simulated" to AuditEventStatus so a prepared-but-not-executed
-- cloud action (every current AWS/Azure/GCP handler in applyEngine.ts)
-- can be recorded distinctly from "applied", which means a real
-- mutation was executed against a live account.
ALTER TYPE "AuditEventStatus" ADD VALUE IF NOT EXISTS 'simulated';
