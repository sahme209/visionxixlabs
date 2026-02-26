-- Structural Stabilization: Add FK relations to AxiomScoreSnapshot and RecurringAnalysis
-- Lead.id must exist for all existing leadId values; orphan rows will fail migration.

-- Add FK to AxiomScoreSnapshot
ALTER TABLE "AxiomScoreSnapshot" ADD CONSTRAINT "AxiomScoreSnapshot_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add FK to RecurringAnalysis
ALTER TABLE "RecurringAnalysis" ADD CONSTRAINT "RecurringAnalysis_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
