-- Capability-scoped approval-writer fence. No historical votes or snapshots
-- are rewritten. Apply only after backup/restore rehearsal and source review.
BEGIN;
SET LOCAL search_path TO public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $fence$ BEGIN
 IF NOT pg_try_advisory_xact_lock(72707369) THEN RAISE EXCEPTION 'approval_enforcement_migration_runner_busy'; END IF;
END $fence$;
LOCK TABLE public."_prisma_migrations" IN SHARE MODE;
LOCK TABLE public."EngineerApprovalDecision", public."EngineerApprovalSnapshot", public."PipelineStageRun", public."PipelineRun" IN SHARE ROW EXCLUSIVE MODE;
DO $preconditions$ BEGIN
 IF current_database()<>'neondb' OR current_setting('server_version_num')::int/10000<>17 THEN RAISE EXCEPTION 'approval_enforcement_wrong_database'; END IF;
 IF to_regprocedure('public.axiom_bound_approval_vote_guard()') IS NOT NULL OR to_regprocedure('public.axiom_bound_approval_snapshot_guard()') IS NOT NULL OR to_regprocedure('public.axiom_bound_approval_stage_guard()') IS NOT NULL THEN RAISE EXCEPTION 'approval_enforcement_already_present_or_partial'; END IF;
 IF EXISTS(SELECT 1 FROM public."EngineerApprovalSnapshot" WHERE "executionStatus"='running') OR EXISTS(
   SELECT 1 FROM public."PipelineRun" r JOIN public."PipelineStageRun" s ON s."runId"=r.id
   LEFT JOIN public."EngineerApprovalSnapshot" a ON a."approvalRequestId"=s."approvalRequestId"
   WHERE r.status NOT IN ('succeeded','failed','cancelled') AND s."approvalRequestId" IS NOT NULL
     AND (s.status<>'awaiting_approval' OR a.status IN ('approved','rejected') OR a.id IS NULL)
 ) OR EXISTS(SELECT 1 FROM public."PipelineStageRun" s JOIN public."EngineerApprovalSnapshot" a ON a."approvalRequestId"=s."approvalRequestId" WHERE s.status='awaiting_approval' AND a.status IN ('approved','rejected')) THEN RAISE EXCEPTION 'approval_enforcement_active_execution_requires_review'; END IF;
 IF current_user::regrole::oid<>(SELECT relowner FROM pg_class WHERE oid='public."User"'::regclass) THEN RAISE EXCEPTION 'approval_enforcement_current_owner_changed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgenabled<>'D' AND tgrelid IN ('public."EngineerApprovalDecision"'::regclass,'public."EngineerApprovalSnapshot"'::regclass,'public."PipelineStageRun"'::regclass)) THEN RAISE EXCEPTION 'approval_enforcement_existing_custom_trigger_requires_review'; END IF;
 IF EXISTS(SELECT 1 FROM pg_event_trigger WHERE evtenabled<>'D') THEN RAISE EXCEPTION 'approval_enforcement_custom_ddl_event_trigger_requires_review'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN ('public."EngineerApprovalDecision"'::regclass,'public."EngineerApprovalSnapshot"'::regclass,'public."PipelineStageRun"'::regclass,'public."PipelineRun"'::regclass) AND relowner<>(SELECT relowner FROM pg_class WHERE oid='public."User"'::regclass)) THEN RAISE EXCEPTION 'approval_enforcement_table_owner_changed'; END IF;
END $preconditions$;
-- BEGIN ENFORCEMENT DEFINITIONS
CREATE FUNCTION public.axiom_bound_approval_vote_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF coalesce(current_setting('axiom.approval_actor_binding',true),'')<>'v1' OR NEW.id !~ '^boundvote_v1_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'approval_writer_upgrade_required'; END IF;
 RETURN NEW;
END $fn$;
CREATE FUNCTION public.axiom_bound_approval_snapshot_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE guarded boolean; approvals integer; rejections integer; legacy integer;
BEGIN
 guarded := NEW.status IN ('approved','rejected') AND (TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status);
 IF TG_OP='UPDATE' AND NEW."executionStatus"='running' AND NEW."executionStatus" IS DISTINCT FROM OLD."executionStatus" THEN guarded:=true; END IF;
 IF NOT guarded THEN RETURN NEW; END IF;
 IF coalesce(current_setting('axiom.approval_actor_binding',true),'')<>'v1' THEN RAISE EXCEPTION 'approval_writer_upgrade_required'; END IF;
 SELECT count(DISTINCT "approverUserId") FILTER(WHERE decision='approved' AND "organizationId"=NEW."organizationId"),count(*) FILTER(WHERE decision='rejected' AND "organizationId"=NEW."organizationId"),count(*) FILTER(WHERE "organizationId"<>NEW."organizationId" OR id !~ '^boundvote_v1_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR decision NOT IN ('approved','rejected')) INTO approvals,rejections,legacy FROM public."EngineerApprovalDecision" WHERE "snapshotId"=NEW.id;
 IF legacy>0 OR (NEW.status='approved' AND (rejections>0 OR approvals<NEW."requiredApprovers")) OR (NEW.status='rejected' AND rejections<1) THEN RAISE EXCEPTION 'approval_actor_provenance_required'; END IF;
 IF TG_OP='UPDATE' AND NEW."executionStatus"='running' AND NEW.status<>'approved' THEN RAISE EXCEPTION 'approval_not_approved'; END IF;
 RETURN NEW;
END $fn$;
CREATE FUNCTION public.axiom_bound_approval_stage_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE bound_status text; bound_id text; bound_org text; required integer; approvals integer; rejections integer; legacy integer;
BEGIN
 IF OLD.status<>'awaiting_approval' OR NEW.status=OLD.status THEN RETURN NEW; END IF;
 IF coalesce(current_setting('axiom.approval_actor_binding',true),'')<>'v1' THEN RAISE EXCEPTION 'approval_writer_upgrade_required'; END IF;
 SELECT s.status,s.id,s."organizationId",s."requiredApprovers" INTO bound_status,bound_id,bound_org,required FROM public."EngineerApprovalSnapshot" s JOIN public."PipelineRun" r ON r.id=OLD."runId" AND r."organizationId"=s."organizationId" WHERE s."approvalRequestId"=OLD."approvalRequestId" AND s."pipelineStageRunId"=OLD.id;
 SELECT count(DISTINCT "approverUserId") FILTER(WHERE decision='approved' AND "organizationId"=bound_org),count(*) FILTER(WHERE decision='rejected' AND "organizationId"=bound_org),count(*) FILTER(WHERE "organizationId"<>bound_org OR id !~ '^boundvote_v1_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR decision NOT IN ('approved','rejected')) INTO approvals,rejections,legacy FROM public."EngineerApprovalDecision" WHERE "snapshotId"=bound_id;
 IF legacy>0 OR (bound_status='approved' AND (rejections>0 OR approvals<required)) OR (bound_status='rejected' AND rejections<1) THEN RAISE EXCEPTION 'approval_actor_provenance_required'; END IF;
 IF (NEW.status='succeeded' AND bound_status IS DISTINCT FROM 'approved') OR (NEW.status='failed' AND bound_status NOT IN ('rejected','expired')) OR NEW.status NOT IN ('succeeded','failed') OR bound_status IS NULL THEN RAISE EXCEPTION 'approval_stage_transition_requires_bound_decision'; END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.axiom_bound_approval_vote_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.axiom_bound_approval_snapshot_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.axiom_bound_approval_stage_guard() FROM PUBLIC;
CREATE TRIGGER axiom_bound_approval_vote BEFORE INSERT OR UPDATE ON public."EngineerApprovalDecision" FOR EACH ROW EXECUTE FUNCTION public.axiom_bound_approval_vote_guard();
CREATE TRIGGER axiom_bound_approval_snapshot BEFORE INSERT OR UPDATE ON public."EngineerApprovalSnapshot" FOR EACH ROW EXECUTE FUNCTION public.axiom_bound_approval_snapshot_guard();
CREATE TRIGGER axiom_bound_approval_stage BEFORE UPDATE ON public."PipelineStageRun" FOR EACH ROW EXECUTE FUNCTION public.axiom_bound_approval_stage_guard();
-- END ENFORCEMENT DEFINITIONS
COMMIT;
