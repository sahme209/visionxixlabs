import { beforeEach, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ session: vi.fn(), load: vi.fn(), audit: vi.fn(), trigger: vi.fn() }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: m.session }));
vi.mock("@/lib/integrations/airflow/connection", () => ({ loadAirflowClient: m.load }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({ appendAuditEvent: m.audit }));
import { GET as dags } from "../route";
import { GET as runs, POST as trigger } from "../[dagId]/runs/route";
const handlers = [dags, runs, trigger];
const request = () => new Request("https://synthetic.invalid/api", {method:"POST", body:"{}"}) as NextRequest;
const context = () => ({params: Promise.resolve({dagId:"synthetic"})});
beforeEach(() => { vi.resetAllMocks(); m.session.mockResolvedValue({id:"s",userId:"u",organizationId:"o"}); });
it.each(handlers.flatMap(handler => ["SYNTHETIC_PRIVATE_MARKER", "airflow_SYNTHETIC_PRIVATE_MARKER", "airflow_api_failed_SYNTHETIC_PRIVATE:secret"].map(message => ({handler,message}))))("redacts $message", async ({handler,message}) => {
  m.load.mockRejectedValueOnce(Error(message)); const response = await handler(request(), context());
  expect(response.status).toBe(502); expect(await response.json()).toEqual({ok:false,error:handler===trigger?"airflow_trigger_failed":"airflow_unavailable"});
});
it.each(handlers)("preserves safe recovery codes in %s", async handler => {
 for (const code of ["airflow_not_connected","airflow_connection_invalid","airflow_trigger_outcome_unknown","airflow_run_conflict_unconfirmed","airflow_api_failed:401:SYNTHETIC_PRIVATE","airflow_auth_failed:403:SYNTHETIC_PRIVATE"]) {
  m.load.mockRejectedValueOnce(Error(code)); const response=await handler(request(),context());
  expect(response.status).toBe(502); expect(await response.json()).toEqual({ok:false,error:code.split(":")[0]});
 }
});
it.each(handlers)("preserves initial session denial in %s", async handler => {
 m.session.mockResolvedValue(null);const response=await handler(request(),context());expect(response.status).toBe(401);expect(await response.json()).toEqual({ok:false,error:"desktop_session_required"});expect(m.load).not.toHaveBeenCalled();
});
it.each(["governance_execution_coverage_unavailable","airflow_mutation_authority_unavailable","airflow_connection_changed"])("preserves exact 409 %s",async code=>{
 m.load.mockRejectedValue(Error(code));const response=await trigger(request(),context());expect(response.status).toBe(409);expect(await response.json()).toEqual({ok:false,error:code});
});
it("does not retry or claim no effect after accepted trigger and private audit failure",async()=>{
 m.trigger.mockResolvedValue({dagRunId:"synthetic-run"});m.load.mockResolvedValue({client:{triggerDag:m.trigger}});m.audit.mockRejectedValue(Error("SYNTHETIC_PRIVATE_AUDIT"));
 const response=await trigger(request(),context());expect(response.status).toBe(502);expect(await response.json()).toEqual({ok:false,error:"airflow_trigger_failed"});expect(m.trigger).toHaveBeenCalledExactlyOnceWith("synthetic",{});expect(m.audit).toHaveBeenCalledOnce();
});

it.each(handlers)("uses fallback for non-Error rejection in %s", async handler => {
 m.load.mockRejectedValue("SYNTHETIC_PRIVATE");const response=await handler(request(),context());expect(response.status).toBe(502);expect(await response.json()).toEqual({ok:false,error:handler===trigger?"airflow_trigger_failed":"airflow_unavailable"});
});
it.each(["governance_execution_coverage_unavailable","airflow_mutation_authority_unavailable","airflow_connection_changed"])("retains 502 for suffixed authority code %s",async code=>{
 m.load.mockRejectedValue(Error(`${code}:SYNTHETIC_PRIVATE`));const response=await trigger(request(),context());expect(response.status).toBe(502);expect(await response.json()).toEqual({ok:false,error:code});
});
it("preserves accepted-trigger success and audit",async()=>{
 const run={dagRunId:"synthetic-run"};m.trigger.mockResolvedValue(run);m.load.mockResolvedValue({client:{triggerDag:m.trigger}});m.audit.mockResolvedValue({});const response=await trigger(request(),context());expect(response.status).toBe(201);expect(await response.json()).toEqual({ok:true,data:{run}});expect(m.trigger).toHaveBeenCalledOnce();expect(m.audit).toHaveBeenCalledOnce();
});
