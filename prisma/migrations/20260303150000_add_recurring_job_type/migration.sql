-- Add jobType to RecurringAnalysis for scheduled monitoring: iam_scan (daily), infra_discovery (weekly)
ALTER TABLE "RecurringAnalysis" ADD COLUMN "jobType" TEXT;

CREATE INDEX IF NOT EXISTS "RecurringAnalysis_jobType_idx" ON "RecurringAnalysis"("jobType");
