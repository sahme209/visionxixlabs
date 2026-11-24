import {beforeEach,it,expect,vi} from 'vitest';import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({auth:vi.fn(),find:vi.fn(),get:vi.fn(),history:vi.fn(),release:vi.fn(),recover:vi.fn()}));
vi.mock('@/lib/db',()=>({prisma:{durableAgentWorkflow:{findFirst:m.find},$transaction:async (fn:any)=>fn({$queryRaw:m.release})}}));vi.mock('../resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:m.auth}));vi.mock('@/lib/api/rateLimiter',()=>({consumeToken:()=>({allowed:true})}));
vi.mock('@/lib/tauri/releaseProviderMergeStore',()=>({createReleaseProviderMergeStore:(_repo:unknown,deps:any)=>({getHistory:async(...args:any[])=>{await deps.assertCurrent({},args[0]);return m.history(...args)},get:async(...args:any[])=>{await deps.assertCurrent({},args[0]);return m.get(...args)},recover:async(...args:any[])=>{await deps.assertCurrent({},args[0]);return m.recover(...args)}})}));
import {handleReleaseProviderMergeOperation} from '../releaseProviderMergeOperationHttp';import {sha256ContentHash} from '@/lib/tauri/contentHash';
const planId='release_plan_'+'a'.repeat(64),actor={id:'session',userId:'user',organizationId:'org',credentialKind:'desktop_session',capabilities:['github:read']};
const plan={kind:'merge_pull_request',organizationId:'org',requestId:'release',requestVersion:3,intakeDigest:'d'.repeat(64),connectionId:'connection',connectionRevision:'2030-01-01T00:00:00Z',window:{startUtc:'2030-01-02T00:00:00Z',endUtc:'2030-01-03T00:00:00Z'},method:'squash',pullRequest:{repositoryFullName:'team/service',number:42,url:'https://github.com/team/service/pull/42',headRef:'feature',headSha:'a'.repeat(40),baseRef:'main',baseSha:'b'.repeat(40)}};
const input={format:1,plan,planDigest:sha256ContentHash(plan),releaseRequesterUserId:'requester',createdAt:'2030-01-01T00:00:00Z',deadlineAt:plan.window.endUtc};
const opId='release_merge_provider_'+sha256ContentHash({organizationId:'org',planId});const operation={id:opId,state:'dispatching',attemptCount:1,version:1,mode:'provider',providerWritePerformed:null};
const req=(method='GET',body?:unknown,query='')=>new NextRequest('https://owned.test/api/desktop/deployments/release/operation-plans/'+planId+'/provider-operation'+query,{method,...(body?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});
beforeEach(()=>{vi.clearAllMocks();m.auth.mockResolvedValue(actor);m.find.mockImplementation(async({where}:any)=>where.workflowKind==='release_operation_plan_v1'?{inputJson:input}:{inputJson:{planId,planInput:input}});m.get.mockResolvedValue(operation);m.recover.mockResolvedValue({...operation,state:'unknown',version:2})});
it('GET reads only the deterministic provider operation without recovery or provider dispatch',async()=>{const r=await handleReleaseProviderMergeOperation(req(),'release',planId);expect(r.status).toBe(200);expect((await r.json()).data).toEqual({operation,providerExecutionAvailable:false});expect(m.get).toHaveBeenCalledWith({organizationId:'org',actorUserId:'user',sessionId:'session'},opId);expect(m.recover).not.toHaveBeenCalled();expect(r.headers.get('cache-control')).toContain('no-store')});
it('explicit recovery forwards expected version, works while execution flags are off and never executes',async()=>{const r=await handleReleaseProviderMergeOperation(req('POST',{action:'recover',expectedVersion:1}),'release',planId);expect(r.status).toBe(200);expect(m.recover).toHaveBeenCalledWith({organizationId:'org',actorUserId:'user',sessionId:'session'},opId,1);expect((await r.json()).data.operation.state).toBe('unknown')});
it('returns no operation for absent history without creating one',async()=>{m.find.mockImplementation(async({where}:any)=>where.workflowKind==='release_operation_plan_v1'?{inputJson:input}:null);expect((await(await handleReleaseProviderMergeOperation(req(),'release',planId)).json()).data.operation).toBeNull();expect(m.get).not.toHaveBeenCalled();expect((await handleReleaseProviderMergeOperation(req('POST',{action:'recover',expectedVersion:1}),'release',planId)).status).toBe(409);expect(m.recover).not.toHaveBeenCalled()});
it('rejects wrong release, altered plan digest and mismatched operation binding before recovery',async()=>{expect((await handleReleaseProviderMergeOperation(req(),'other',planId)).status).toBe(409);m.find.mockResolvedValue({inputJson:{...input,planDigest:'f'.repeat(64)}});expect((await handleReleaseProviderMergeOperation(req(),'release',planId)).status).toBe(409);m.find.mockImplementation(async({where}:any)=>where.workflowKind==='release_operation_plan_v1'?{inputJson:input}:{inputJson:{planId:'other',planInput:input}});expect((await handleReleaseProviderMergeOperation(req('POST',{action:'recover',expectedVersion:1}),'release',planId)).status).toBe(409);expect(m.recover).not.toHaveBeenCalled()});
it.each([{action:'recover',expectedVersion:1,actorUserId:'forged'},{action:'execute',expectedVersion:1},{action:'recover',expectedVersion:3}])('rejects extra identity, execute and malformed state %j',async body=>{expect((await handleReleaseProviderMergeOperation(req('POST',body),'release',planId)).status).toBe(400);expect(m.recover).not.toHaveBeenCalled()});
it('rejects query identity/API keys and changed paired session before result',async()=>{expect((await handleReleaseProviderMergeOperation(req('GET',undefined,'?operationId=forged'),'release',planId)).status).toBe(400);m.auth.mockResolvedValue({...actor,credentialKind:'api_key'});expect((await handleReleaseProviderMergeOperation(req(),'release',planId)).status).toBe(401);m.auth.mockResolvedValueOnce(actor).mockResolvedValue({...actor,id:'changed'});expect((await handleReleaseProviderMergeOperation(req(),'release',planId)).status).toBe(401)});

it('projects exact dated provider merge history without invoking recovery',async()=>{
 const intakeJson={title:'Fixture'};
 const exactPlan={...plan,intakeDigest:sha256ContentHash({requestVersion:3,intake:intakeJson})};
 const exact={...input,plan:exactPlan,planDigest:sha256ContentHash(exactPlan)};
 const id='release_plan_'+sha256ContentHash(['org','release',3,exact.planDigest]);
 m.find.mockImplementation(async({where})=>where.workflowKind==='release_operation_plan_v1'
  ? {id,organizationId:'org',workflowKind:'release_operation_plan_v1',inputJson:exact} : {inputJson:{planId:id,planInput:exact}});
 m.release.mockResolvedValue([{id:'release',organizationId:'org',version:3,requesterUserId:'requester',intakeJson}]);
 const events=[{type:'prepared',at:'2030-01-02T00:00:00Z'},{type:'dispatching',at:'2030-01-02T00:01:00Z'},{type:'unknown',at:'2030-01-02T00:02:00Z'}];
 m.history.mockResolvedValue(events);
 const historyRequest=new NextRequest(req().url.replace(planId,id)+'?historyVersion=3');
 const response=await handleReleaseProviderMergeOperation(historyRequest,'release',id);
 expect(response.status).toBe(200);
 expect(await response.json()).toEqual({ok:true,data:{requestId:'release',requestVersion:3,planId:id,planDigest:exact.planDigest,events}});
 m.find.mockImplementation(async({where})=>where.workflowKind==='release_operation_plan_v1'
  ? {id,organizationId:'org',workflowKind:'release_operation_plan_v1',inputJson:exact} : null);
 m.release.mockResolvedValue([{id:'release',organizationId:'org',version:3,requesterUserId:'requester',intakeJson:{title:'Changed'}}]);
 expect((await handleReleaseProviderMergeOperation(historyRequest,'release',id)).status).toBe(409);
 expect(m.get).not.toHaveBeenCalled();
 expect(m.recover).not.toHaveBeenCalled();
});
