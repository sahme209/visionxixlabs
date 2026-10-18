-- REVIEW PROPOSAL ONLY. No production application or migration backlog.
BEGIN;
CREATE TABLE public."AirflowExecutionReviewFeature" (
  "version" integer PRIMARY KEY CHECK ("version" = 1),
  "proposalChecksum" text NOT NULL CHECK ("proposalChecksum" ~ '^[a-f0-9]{64}$')
);
CREATE TABLE public."AirflowExecutionReview" (
  "executionId" text PRIMARY KEY REFERENCES public."AirflowAutomationExecution"("id"),
  "organizationId" text NOT NULL,
  "automationId" text NOT NULL REFERENCES public."AirflowAutomation"("id"),
  "payload" jsonb NOT NULL CHECK (octet_length("payload"::text) <= 16384),
  "digest" text NOT NULL CHECK ("digest" ~ '^[a-f0-9]{64}$'),
  "createdAt" timestamp(3) NOT NULL
);
CREATE FUNCTION public.axiom_airflow_review_guard_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'airflow_review_immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public."AirflowAutomationExecution" e
    JOIN public."AirflowAutomation" a ON a."id"=e."automationId" AND a."organizationId"=e."organizationId"
    WHERE e."id"=NEW."executionId" AND e."organizationId"=NEW."organizationId" AND e."automationId"=NEW."automationId"
      AND e."status"='pending_approval' AND e."attempt"=0 AND a."actionType"='deploy'
      AND NEW."payload"->>'schema'='axiom.airflow.restart-review.v1'
      AND NEW."payload"->>'organizationId'=e."organizationId"
      AND NEW."payload"->>'executionId'=e."id" AND NEW."payload"->>'automationId'=a."id"
      AND NEW."payload"->'source'->>'dagId'=e."sourceDagId"
      AND NEW."payload"->'source'->>'runId'=e."sourceDagRunId"
      AND NEW."payload"->'source'->>'state'=e."sourceDagState") THEN
    RAISE EXCEPTION 'airflow_review_parent_binding_invalid';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER axiom_airflow_review_guard_v1 BEFORE INSERT OR UPDATE OR DELETE
  ON public."AirflowExecutionReview" FOR EACH ROW EXECUTE FUNCTION public.axiom_airflow_review_guard_v1();
-- A separately reviewed installer writes the exact proposal SHA256 marker.
COMMIT;
