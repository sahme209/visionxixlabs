import {beforeEach,afterEach,it,expect,vi} from 'vitest';import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({auth:vi.fn(),release:vi.fn(),plan:vi.fn(),list:vi.fn(),create:vi.fn(),review:vi.fn(),cancel:vi.fn(),preview:vi.fn(),issue:vi.fn(),consume:vi.fn()}));
vi.mock('@/lib/db',()=>({prisma:{tauriDeploymentRequest:{findFirst:m.release},durableAgentWorkflow:{findFirst:m.plan}}}));
vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:m.auth}));vi.mock('@/lib/api/rateLimiter',()=>({consumeToken:()=>({allowed:true})}));
vi.mock('@/lib/agent/workflows/releaseOperationPlanStore',()=>({createReleaseOperationPlan:m.create,listReleaseOperationPlans:m.list,reviewReleaseOperationPlan:m.review,cancelReleaseOperationPlan:m.cancel}));
vi.mock('@/lib/tauri/readReleaseOperationPreviewPlan',()=>({readReleaseOperationPreviewPlan:m.preview}));vi.mock('@/lib/tauri/releaseOperationPreview',()=>({releaseOperationPreviewCache:{issue:m.issue,consume:m.consume}}));
import {handleReleaseOperationPlans,handleReleaseOperationPlanPreview,handleReleaseOperationPlanMutation} from '../releaseOperationPlanHttp';
const principal={id:'session',organizationId:'org',userId:'user',role:'admin',credentialKind:'desktop_session',capabilities:['github:read','deploy:execute','agent:approve']};
const req=(method='GET',body?:unknown,query='?expectedVersion=2')=>new NextRequest('https://example.test/api/desktop/deployments/release/operation-plans'+query,{method,...(body?{body:JSON.stringify(body),headers:{'content-type':'application/json'}}:{})});
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('AXIOM_RELEASE_OPERATION_PLANS_ENABLED','true');m.auth.mockResolvedValue(principal);m.release.mockResolvedValue({id:'release',organizationId:'org',version:2});m.list.mockResolvedValue({plans:[],truncated:false});m.consume.mockReturnValue({plan:{requestId:'release',requestVersion:2},digest:'d'});m.create.mockImplementation(async(_repo,input)=>{await input.assertCurrent();return{id:'saved'}});m.issue.mockReturnValue({previewToken:'rpv_'+'a'.repeat(64),executionAvailable:false})});afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()});
it('requires paired current GitHub read authority and no API key for listing',async()=>{expect((await handleReleaseOperationPlans(req(),'release')).status).toBe(200);expect(m.auth).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({requiredScope:'pipeline:read',requiredCapability:'github:read',requireWorkspaceMembership:true,allowApiKey:false}));m.auth.mockResolvedValue({...principal,credentialKind:'api_key'});expect((await handleReleaseOperationPlans(req(),'release')).status).toBe(401)});
it('saves only a server preview under paired deploy permission without invoking a provider',async()=>{const r=await handleReleaseOperationPlans(req('POST',{expectedVersion:2,previewToken:'rpv_'+'a'.repeat(64)},''),'release');expect(r.status).toBe(201);expect(m.preview).not.toHaveBeenCalled();expect(m.create).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({actorUserId:'user',organizationId:'org',plan:{requestId:'release',requestVersion:2}}));expect(m.auth).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({requiredScope:'pipeline:trigger',requiredCapability:'deploy:execute'}))});
it('refuses actor changes before storage commit',async()=>{m.auth.mockResolvedValueOnce(principal).mockResolvedValueOnce({...principal,userId:'other'});expect((await handleReleaseOperationPlans(req('POST',{expectedVersion:2,previewToken:'rpv_'+'a'.repeat(64)},''),'release')).status).toBe(401)});
it.each([{expectedVersion:2,previewToken:'rpv_'+'a'.repeat(64),plan:{forged:true}},{expectedVersion:0,previewToken:'x'},{expectedVersion:2,previewToken:'rpv_'+'a'.repeat(64),actorUserId:'attacker'}])('rejects untrusted extra fields and malformed body',async body=>{expect((await handleReleaseOperationPlans(req('POST',body,''),'release')).status).toBe(400);expect(m.create).not.toHaveBeenCalled()});
it('does not mint previews while disabled and rejects duplicate/extra query parameters',async()=>{vi.stubEnv('AXIOM_RELEASE_OPERATION_PLANS_ENABLED','false');expect((await handleReleaseOperationPlanPreview(req('GET',undefined,'?expectedVersion=2&pullRequestNumber=1&method=merge'),'release')).status).toBe(409);expect(m.preview).not.toHaveBeenCalled();vi.stubEnv('AXIOM_RELEASE_OPERATION_PLANS_ENABLED','true');expect((await handleReleaseOperationPlans(req('GET',undefined,'?expectedVersion=2&expectedVersion=3'),'release')).status).toBe(400)});

it('uses final permissions for capabilities after a mid-read role downgrade',async()=>{m.auth.mockResolvedValueOnce(principal).mockResolvedValue({...principal,capabilities:['github:read'],role:'read_only'});m.list.mockResolvedValue({plans:[{canReview:true,canCancel:true}],truncated:false});const response=await handleReleaseOperationPlans(req(),'release');const value=await response.json();expect(value.data.canManage).toBe(false);expect(value.data.plans[0]).toMatchObject({canReview:false,canCancel:false})});
it('retains creator cancellation while monitoring is disabled without offering review',async()=>{vi.stubEnv('AXIOM_RELEASE_OPERATION_PLANS_ENABLED','false');m.list.mockResolvedValue({plans:[{canReview:true,canCancel:true}],truncated:false});const value=await(await handleReleaseOperationPlans(req(),'release')).json();expect(value.data).toMatchObject({enabled:false,canManage:false,plans:[{canReview:false,canCancel:true}]})});

it('refuses a feature switch disabled during the final authority lookup',async()=>{m.auth.mockResolvedValueOnce(principal).mockImplementation(async()=>{vi.stubEnv('AXIOM_RELEASE_OPERATION_PLANS_ENABLED','false');return principal});const response=await handleReleaseOperationPlans(req('POST',{expectedVersion:2,previewToken:'rpv_'+'a'.repeat(64)},''),'release');expect(response.status).toBe(409);expect((await response.json()).error).toBe('release_operation_plans_disabled')});

// A complete strict persisted binding: mutation tests exercise the real input
// parser and handler; independent-review persistence is covered by store tests.
function storedOperationPlan(){
 const plan={kind:'merge_pull_request' as const,organizationId:'org',requestId:'release',requestVersion:2,intakeDigest:'a'.repeat(64),connectionId:'github-1',connectionRevision:'2030-01-01T00:00:00.000Z',window:{startUtc:'2030-01-02T01:00:00.000Z',endUtc:'2030-01-02T02:00:00.000Z'},method:'squash' as const,pullRequest:{repositoryFullName:'team/service',number:42,url:'https://github.com/team/service/pull/42',headRef:'release/demo',headSha:'b'.repeat(40),baseRef:'main',baseSha:'c'.repeat(40)}};
 return{plan,planDigest:'d'.repeat(64),inputJson:{format:1,plan,planDigest:'d'.repeat(64),releaseRequesterUserId:'release-requester',createdAt:'2030-01-01T00:00:00.000Z',deadlineAt:'2030-01-02T02:00:00.000Z'}};
}
const mutationPlanId='release_plan_'+'f'.repeat(64),mutationActionId='00000000-0000-4000-8000-000000000001',mutationPreviewToken='rpv_'+'a'.repeat(64);
it('forwards an independently bound cached review with the exact action UUID and plan version, without a provider read',async()=>{
 const stored=storedOperationPlan();m.plan.mockResolvedValue({id:mutationPlanId,organizationId:'org',requestedByUserId:'plan-creator',version:7,inputJson:stored.inputJson});m.consume.mockReturnValue({plan:stored.plan,digest:stored.planDigest});
 m.review.mockImplementationOnce(async(_repo,input)=>{expect(input.actorUserId).not.toBe(stored.inputJson.releaseRequesterUserId);expect(input.actorUserId).not.toBe('plan-creator');await input.assertCurrent();return{id:mutationPlanId,status:'reviewed',executionAvailable:false}});
 const fetcher=vi.fn(async()=>{throw Error('unexpected provider request')});vi.stubGlobal('fetch',fetcher);
 const response=await handleReleaseOperationPlanMutation(req('POST',{expectedPlanVersion:7,previewToken:mutationPreviewToken,decision:'reviewed',clientRequestId:mutationActionId},''),'release',mutationPlanId,true);
 expect(response.status).toBe(200);expect(await response.json()).toMatchObject({ok:true,data:{enabled:true,plan:{id:mutationPlanId,status:'reviewed',executionAvailable:false}}});
 expect(m.review).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({organizationId:'org',actorUserId:'user',id:mutationPlanId,expectedVersion:7,clientRequestId:mutationActionId,decision:'reviewed',currentPlan:stored.plan,currentPlanDigest:stored.planDigest,assertCurrent:expect.any(Function)}));
 expect(m.consume).toHaveBeenCalledWith({organizationId:'org',userId:'user',sessionId:'session',requestId:'release',requestVersion:2},mutationPreviewToken);expect(m.preview).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();expect(m.cancel).not.toHaveBeenCalled();
});
it('permits creator cancellation while the feature is disabled, with current paired deploy authority',async()=>{
 const stored=storedOperationPlan();vi.stubEnv('AXIOM_RELEASE_OPERATION_PLANS_ENABLED','false');m.plan.mockResolvedValue({id:mutationPlanId,organizationId:'org',requestedByUserId:'user',version:3,inputJson:stored.inputJson});m.cancel.mockImplementationOnce(async(_repo,input)=>{await input.assertCurrent();return{id:mutationPlanId,status:'cancelled',executionAvailable:false}});
 const response=await handleReleaseOperationPlanMutation(req('DELETE',{expectedPlanVersion:3,clientRequestId:mutationActionId},''),'release',mutationPlanId);
 expect(response.status).toBe(200);expect(await response.json()).toMatchObject({ok:true,data:{enabled:false,plan:{status:'cancelled'}}});expect(m.cancel).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({organizationId:'org',actorUserId:'user',id:mutationPlanId,expectedVersion:3,clientRequestId:mutationActionId}));expect(m.auth).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({requiredScope:'pipeline:trigger',requiredCapability:'deploy:execute',allowApiKey:false,requireWorkspaceMembership:true}));expect(m.review).not.toHaveBeenCalled();expect(m.consume).not.toHaveBeenCalled();
});
it.each([false,true])('rejects a stored plan bound to another request path before mutation (review=%s)',async review=>{
 const stored=storedOperationPlan();m.plan.mockResolvedValue({id:mutationPlanId,organizationId:'org',inputJson:stored.inputJson});const body=review?{expectedPlanVersion:0,clientRequestId:mutationActionId,previewToken:mutationPreviewToken,decision:'reviewed'}:{expectedPlanVersion:0,clientRequestId:mutationActionId};
 const response=await handleReleaseOperationPlanMutation(req(review?'POST':'DELETE',body,''),'another-release',mutationPlanId,review);expect(response.status).toBe(409);expect(await response.json()).toMatchObject({error:'release_plan_changed'});expect(m.review).not.toHaveBeenCalled();expect(m.cancel).not.toHaveBeenCalled();expect(m.consume).not.toHaveBeenCalled();
});
it.each([false,true])('rejects client-supplied actor authority on mutation (review=%s)',async review=>{
 const stored=storedOperationPlan();m.plan.mockResolvedValue({id:mutationPlanId,organizationId:'org',inputJson:stored.inputJson});const body=review?{expectedPlanVersion:0,clientRequestId:mutationActionId,previewToken:mutationPreviewToken,decision:'reviewed',actorUserId:'attacker'}:{expectedPlanVersion:0,clientRequestId:mutationActionId,actorUserId:'attacker'};
 const response=await handleReleaseOperationPlanMutation(req(review?'POST':'DELETE',body,''),'release',mutationPlanId,review);expect(response.status).toBe(400);expect(m.review).not.toHaveBeenCalled();expect(m.cancel).not.toHaveBeenCalled();expect(m.consume).not.toHaveBeenCalled();
});

import {completeReleaseIntake} from '@/lib/tauri/__tests__/fixtures/completeReleaseIntake';
it.each(['preview','save'])('refuses a non-fixture %s after the initial acceptance scope snapshot',async action=>{
 vi.stubEnv('AXIOM_RELEASE_OPERATION_PLANS_ENABLED','false');vi.stubEnv('AXIOM_RELEASE_ACCEPTANCE_ENABLED','true');vi.stubEnv('AXIOM_RELEASE_ACCEPTANCE_ORGANIZATION_ID','org');
 const intake={...completeReleaseIntake(),tenantId:'org',repositoryUrls:['https://github.com/sahme209/axiom-release-acceptance'],workflowSource:{repositoryFullName:'sahme209/axiom-release-acceptance',ref:'axiom-release-test',path:'.github/workflows/deploy.yml',blobSha:'c'.repeat(40)}};m.release.mockResolvedValue({id:'release',organizationId:'org',version:2,intakeJson:intake});const foreign={organizationId:'org',requestId:'release',requestVersion:2,pullRequest:{repositoryFullName:'sahme209/customer'}};m.preview.mockResolvedValue(foreign);m.consume.mockReturnValue({plan:foreign,digest:'d'});
 const r=action==='preview'?await handleReleaseOperationPlanPreview(req('GET',undefined,'?expectedVersion=2&pullRequestNumber=1&method=merge'),'release'):await handleReleaseOperationPlans(req('POST',{expectedVersion:2,previewToken:'rpv_'+'a'.repeat(64)},''),'release');expect(r.status).toBe(409);expect(m.issue).not.toHaveBeenCalled();expect(m.create).not.toHaveBeenCalled();
});

it('offers review without plan creation/cancellation to an existing approval-only reviewer',async()=>{
 m.auth.mockResolvedValue({...principal,role:'security_reviewer',capabilities:['github:read','agent:approve']});
 m.list.mockResolvedValue({plans:[{canReview:true,canCancel:true}],truncated:false});
 const value=await(await handleReleaseOperationPlans(req(),'release')).json();
 expect(value.data).toMatchObject({canManage:false,plans:[{canReview:true,canCancel:false}]});
 expect((await handleReleaseOperationPlans(req('POST',{expectedVersion:2,previewToken:'rpv_'+'a'.repeat(64)},''),'release')).status).toBe(403);
 expect(m.create).not.toHaveBeenCalled();
});
it('refuses review mutations by an executor lacking approval permission',async()=>{
 m.auth.mockResolvedValue({...principal,role:'operator',capabilities:['github:read','deploy:execute']});
 const r=await handleReleaseOperationPlanMutation(req('POST',{expectedPlanVersion:0,clientRequestId:mutationActionId,previewToken:mutationPreviewToken,decision:'reviewed'},''),'release',mutationPlanId,true);
 expect(r.status).toBe(403);expect(m.review).not.toHaveBeenCalled();
});
