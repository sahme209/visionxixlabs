import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const f=vi.hoisted(()=>({connection:null as any,rule:null as any,enrolled:false,metadataError:false,actor:null as any,afterAuth:'' as string,finalMetadata:'' as string,sessionExpiry:null as Date|null,calls:[] as Array<{path:string;method:string;body:any}>,decrypt:vi.fn(),audit:vi.fn(),snapshot:vi.fn(),advance:vi.fn(),conflict:false}));
vi.mock('@/lib/db',()=>({prisma:{
 desktopSessionRecord:{findUnique:async()=>({id:'session',userId:'operator',organizationId:'org',revokedAt:null,expiresAt:f.sessionExpiry??new Date(Date.now()+60000)})},
 tenantIntegrationConnection:{findUnique:async()=>structuredClone(f.connection),findFirst:async({where}:any)=>f.connection?.id===where.id&&f.connection.status===where.status&&f.connection.updatedAt.getTime()===where.updatedAt.getTime()?{id:f.connection.id}:null},
 durableAgentWorkflow:{findMany:async()=>{if(f.metadataError)throw Error('SIMULATED private metadata failure');if(f.calls.some(c=>c.path==='/auth/token')){if(f.finalMetadata==='role')f.actor=null;if(f.finalMetadata==='rule')f.rule.enabled=false;}return f.enrolled?[{id:'governance_active_fixture',organizationId:'org',workflowKind:'governance_baseline_active_v1'}]:[]}},
 airflowAutomation:{groupBy:async()=>[{organizationId:'org'}],findMany:async()=>[structuredClone(f.rule)],findFirst:async({where}:any)=>f.rule?.enabled&&f.rule.id===where.id&&f.rule.organizationId===where.organizationId&&f.rule.connectionId===where.connectionId&&f.rule.updatedAt.getTime()===where.updatedAt.getTime()?{id:f.rule.id}:null,updateMany:f.advance,update:async()=>({})},
 airflowAutomationExecution:{findMany:async()=>[],findUnique:async()=>null},airflowDagRunSnapshot:{upsert:f.snapshot},
}}));
vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:async()=>f.actor}));
vi.mock('@/lib/security/credentialVault',()=>({decryptScopedCredential:f.decrypt}));
vi.mock('@/lib/releaseops/auditEventResponder',()=>({appendAuditEvent:f.audit}));
vi.mock('@/lib/webhooks/dispatchWebhookEvent',()=>({dispatchWebhookEvent:async()=>undefined}));
vi.mock('../automationExecutor',()=>({executeAirflowAutomation:async()=>({ok:false,error:'not_actionable'})}));
vi.mock('../airflowClient',async(importActual)=>({...await importActual<any>(),validateAirflowBaseUrl:async(v:string)=>v}));
import {loadAirflowClient} from '../connection';
import {runAirflowAutomationTick} from '../automationTick';
import {POST} from '../../../../app/api/desktop/airflow/dags/[dagId]/runs/route';
const now=new Date('2026-11-02T10:01:00Z');
beforeEach(()=>{
 vi.resetAllMocks();f.enrolled=false;f.metadataError=false;f.afterAuth='';f.finalMetadata='';f.sessionExpiry=null;f.calls=[];f.conflict=false;
 f.actor={id:'session',userId:'operator',organizationId:'org',credentialKind:'desktop_session',capabilities:['workspace:read','deploy:execute']};
 f.connection={id:'connection',organizationId:'org',provider:'airflow',status:'active',revokedAt:null,updatedAt:new Date('2026-11-01T00:00:00Z'),encryptedCredential:'SIMULATED_CIPHER',scopesJson:{baseUrl:'https://airflow.example.invalid'}};
 f.rule={id:'rule',organizationId:'org',enabled:true,connectionId:'connection',dagId:'daily',triggerMode:'schedule',scheduleCron:'0 * * * *',nextScheduledAt:new Date('2026-11-02T10:00:00Z'),updatedAt:new Date('2026-11-01T00:00:00Z'),createdAt:new Date('2026-11-01T00:00:00Z'),actionType:'none',dependencyDagIds:[],requiredDagState:'success'};
 f.decrypt.mockReturnValue(JSON.stringify({authMode:'username_password',username:'fixture',password:'SIMULATED'}));f.advance.mockResolvedValue({count:1});
 vi.stubGlobal('fetch',vi.fn(async(url:string,init:any)=>{
  const path=new URL(url).pathname,body=init.body?JSON.parse(init.body):undefined;f.calls.push({path,method:init.method??'GET',body});
  if(path==='/auth/token'){if(f.afterAuth==='enrollment')f.enrolled=true;if(f.afterAuth==='role')f.actor=null;if(f.afterAuth==='connection')f.connection.updatedAt=new Date('2026-11-02T00:00:00Z');if(f.afterAuth==='rule')f.rule.enabled=false;return Response.json({access_token:'SIMULATED'})}
  if(init.method==='POST'){if(f.conflict){f.enrolled=true;return Response.json({},{status:409})}return Response.json({dag_id:'daily',dag_run_id:body.dag_run_id,state:'queued'})}
  if(/\/dagRuns\/[^/]+$/.test(path))return Response.json({dag_id:'daily',dag_run_id:decodeURIComponent(path.split('/').at(-1)!),state:'success'});
  return Response.json({dag_runs:[]});
 }));
});
afterEach(()=>vi.unstubAllGlobals());
const manual=()=>POST(new NextRequest('https://fixture.invalid/api/desktop/airflow/dags/daily/runs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({conf:{review:'fixture'}})}),{params:Promise.resolve({dagId:'daily'})});
const writes=()=>f.calls.filter(c=>c.method==='POST'&&c.path.includes('/api/v2/'));
it.each(['enrolled','unavailable'])('actual manual route refuses %s metadata before authentication or DAG POST',async state=>{f.enrolled=state==='enrolled';f.metadataError=state==='unavailable';const r=await manual();expect(r.status).toBe(409);expect(f.calls).toEqual([]);expect(f.decrypt).not.toHaveBeenCalled();expect(f.audit).not.toHaveBeenCalled()});
it.each(['enrollment','role','connection'])('actual manual route withholds POST after %s changes during provider auth',async change=>{f.afterAuth=change;const r=await manual();expect(r.status).toBe(409);expect(writes()).toEqual([]);expect(f.calls.filter(c=>c.path==='/auth/token')).toHaveLength(1)});
it('actual manual route retains current unenrolled operator execution',async()=>{const r=await manual();expect(r.status).toBe(201);expect(writes()).toHaveLength(1);expect(writes()[0].body.conf).toEqual({review:'fixture'});expect(f.audit).toHaveBeenCalledOnce()});
it('read-only factory clients preserve reads but cannot acquire mutation authority from a saved connection',async()=>{const loaded=await loadAirflowClient('org');expect(await loaded.client.listDagRuns('daily')).toEqual([]);f.calls=[];await expect(loaded.client.triggerDag('daily',{},'exact')).rejects.toThrow('airflow_mutation_authority_unavailable');expect(f.calls).toEqual([])});
it.each(['enrolled','unavailable'])('actual scheduled tick refuses %s metadata without provider POST or schedule advancement',async state=>{f.enrolled=state==='enrolled';f.metadataError=state==='unavailable';expect(await runAirflowAutomationTick(now)).toMatchObject({errors:1});expect(writes()).toEqual([]);expect(f.calls).toEqual([]);expect(f.advance).not.toHaveBeenCalled()});
it.each(['enrollment','connection','rule'])('actual scheduled trigger rechecks %s after authentication',async change=>{f.afterAuth=change;expect(await runAirflowAutomationTick(now)).toMatchObject({errors:1});expect(writes()).toEqual([]);expect(f.advance).not.toHaveBeenCalled()});
it('actual scheduler preserves its recorded deterministic ID and exact 409 read reconciliation without a fresh POST',async()=>{f.conflict=true;expect(await runAirflowAutomationTick(now)).toMatchObject({errors:0});expect(writes()).toHaveLength(1);const id=writes()[0].body.dag_run_id;expect(id).toMatch(/^axiom_schedule__/);expect(f.calls.some(c=>c.method==='GET'&&c.path.endsWith('/'+id))).toBe(true);expect(f.snapshot).toHaveBeenCalledWith(expect.objectContaining({where:{connectionId_dagId_dagRunId:{connectionId:'connection',dagId:'daily',dagRunId:id}},create:expect.objectContaining({organizationId:'org',dagId:'daily',dagRunId:id})}));expect(f.advance).toHaveBeenCalledOnce()});

it('manual current actor revoked during final metadata await prevents POST',async()=>{f.finalMetadata='role';expect((await manual()).status).toBe(409);expect(writes()).toEqual([])});
it('scheduled rule disabled during final metadata await prevents POST',async()=>{f.finalMetadata='rule';expect(await runAirflowAutomationTick(now)).toMatchObject({errors:1});expect(writes()).toEqual([]);expect(f.advance).not.toHaveBeenCalled()});

it('actual manual route refuses an expired persisted paired session despite simulated resolver success',async()=>{f.sessionExpiry=new Date(Date.now()-1);expect((await manual()).status).toBe(409);expect(writes()).toEqual([]);expect(f.audit).not.toHaveBeenCalled()});
