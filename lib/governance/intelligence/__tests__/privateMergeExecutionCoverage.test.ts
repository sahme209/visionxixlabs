import {beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const native=vi.hoisted(()=>({identity:Object.freeze({status:'current',issuerArtifactDigest:'d'.repeat(64),executingIssuerIdentity:'current',runtimeQualification:'unavailable',fleetQualification:'unavailable',legacyQualification:'unavailable',executionAuthorized:false}) as Record<string,unknown>}));
vi.mock('@axiom/verified-issuer-runtime',()=>({readIssuerIdentity:()=>native.identity}));
import {createPrivateMergeExecutionCoverage,isPrivateMergeExecutionCoverage,isPrivateMergeRequestCoverage,assertPrivateMergeExecutionComposition,PRIVATE_MERGE_EXECUTION_FACTORIES,type PrivateMergeExecutionGraph} from '../privateMergeExecutionCoverage';
import {reviewedDeploymentFixture} from './fixtures/reviewedDeployment';
import {governanceContextFromReviewedRelease} from '../releaseScope';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {RELEASE_OPERATION_PLAN_KIND} from '@/lib/tauri/releaseOperationPlanContract';
import {compileBaseline} from '../contracts';
import {releaseProviderMergeExecutionId} from '@/lib/tauri/releaseProviderMergeStore';
import {createReleaseProviderMergeCoordinatorCore} from '@/lib/desktop/releaseProviderMergeCoordinatorCore';

/** Real contracts/coverage source; native identity, handler construction and SQL observations are simulated. */
function fixture(){
 const f=reviewedDeploymentFixture(),now=Date.now(),scope=f.scope,plan=f.reviewedPlan,planId=f.plan.planId;
 let permitted=true;
 const resolveSession=vi.fn(async()=>permitted?{id:scope.sessionId,userId:scope.actorUserId,organizationId:scope.organizationId,credentialKind:'desktop_session',capabilities:['workspace:read','policy:manage','github:read','deploy:execute']}:null);
 const createdAt=new Date(now-500),deadlineAt=new Date(plan.window.endUtc);
 const input={format:1,plan,planDigest:sha256ContentHash(plan),releaseRequesterUserId:'requester',createdAt:createdAt.toISOString(),deadlineAt:deadlineAt.toISOString()};
 const row={id:planId,organizationId:scope.organizationId,workflowKind:RELEASE_OPERATION_PLAN_KIND,requestedByUserId:'creator',status:'completed',currentStep:'reviewed',inputJson:input,stateJson:{reviewStatus:'reviewed'},attemptCount:0,maxAttempts:1,version:1,leaseOwner:null,leaseExpiresAt:null,approvalProposalId:null,createdAt,updatedAt:new Date(now-100)};
 const events=[{workflowRunId:planId,organizationId:scope.organizationId,sequence:0,eventType:'release_plan.created',actorKind:'user',actorId:'creator',detailJson:{},occurredAt:createdAt},{workflowRunId:planId,organizationId:scope.organizationId,sequence:1,eventType:'release_plan.reviewed',actorKind:'user',actorId:'reviewer',detailJson:{},occurredAt:new Date(now-100)}];
 const tx={$queryRaw:vi.fn(async(strings:TemplateStringsArray,...values:unknown[])=>{
  const q=strings.join('?');
  if(q.includes('FROM "OrgMembership"'))return[{id:'member',organizationId:scope.organizationId,userId:values[1],role:'owner',acceptedAt:new Date(now-10000)}];
  if(q.includes('FROM "DesktopSessionRecord"'))return[{id:scope.sessionId,organizationId:scope.organizationId,userId:scope.actorUserId,live:permitted,revokedAt:null,expiresAt:new Date(now+60000),now:new Date(Date.now())}];
  if(q.includes('FROM "DurableAgentWorkflow"'))return[row];
  if(q.includes('FROM "TauriDeploymentRequest"'))return[q.includes('requesterUserId')?{...f.row,requesterUserId:'requester'}:f.row];
  if(q.includes('FROM "GitHubInstallation"'))return[{id:plan.connectionId,organizationId:scope.organizationId,status:'active',updatedAt:new Date(plan.connectionRevision),githubInstallationId:'123',revokedAt:null,suspendedAt:null}];
  if(q.includes('clock_timestamp()'))return[{now:new Date(Date.now())}];
  return[{locked:1}];
 }),durableAgentWorkflow:{findFirst:vi.fn(async(args:{where:{id?:string}})=>args.where.id===planId?row:null),findMany:vi.fn(async()=>[])},durableAgentWorkflowEvent:{findMany:vi.fn(async()=>events)}};
 const repo={...tx,$transaction:vi.fn(async(fn:(t:typeof tx)=>unknown)=>fn(tx))};
 const transport=vi.fn(async()=>{throw Error('NO NETWORK IN COVERAGE TEST')}) as unknown as typeof fetch;
 const graph:PrivateMergeExecutionGraph={repo:repo as never,resolveSession:resolveSession as never,releaseAuth:Object.freeze({resolveReleaseInstallationToken:vi.fn(),readReleaseInstallationEligibility:vi.fn(),consumeReleaseInstallationEligibility:vi.fn()}) as never,transport,handlers:Object.freeze({execution:vi.fn(),operation:vi.fn()}),forRequest:vi.fn(),factories:PRIVATE_MERGE_EXECUTION_FACTORIES};
 const request=new NextRequest(`https://axiom.invalid/api/desktop/deployments/${f.row.id}/operation-plans/${planId}/provider-execution`);
 const make=()=>createPrivateMergeExecutionCoverage(repo as never,{resolveSession:resolveSession as never,now:()=>Date.now()},Object.freeze({...graph}));
 const context=governanceContextFromReviewedRelease({scope,row:f.row,plan});
 return{...f,repo,tx,graph,request,scope,context,make,transport,resolveSession,revoke:()=>{permitted=false}};
}
beforeEach(()=>{native.identity=Object.freeze({status:'current',issuerArtifactDigest:'d'.repeat(64),executingIssuerIdentity:'current',runtimeQualification:'unavailable',fleetQualification:'unavailable',legacyQualification:'unavailable',executionAuthorized:false})});
describe('private merge registered coverage',()=>{
 it('brands only privately constructed registrations and derives the stored scope',async()=>{
  const f=fixture(),registration=f.make(),request=registration.forRequest(f.request,f.scope);
  expect(isPrivateMergeExecutionCoverage(registration)).toBe(true);expect(isPrivateMergeRequestCoverage(request)).toBe(true);
  expect(isPrivateMergeRequestCoverage({...request})).toBe(false);
  await expect(request.readCoverage(f.context.scope,f.request.signal)).resolves.toEqual({coveredActions:['repository.merge']});
  expect(f.transport).not.toHaveBeenCalled();expect(f.resolveSession).toHaveBeenCalled();
 });
 it('rejects a substituted factory or repository before issuing coverage',()=>{
  const f=fixture();Object.defineProperty(f.graph,'factories',{value:{...f.graph.factories,executor:vi.fn()}});
  expect(f.make).toThrow('governance_private_coverage_unavailable');
 });
 it('rejects another source scope and a current-session revocation',async()=>{
  const f=fixture(),handle=f.make().forRequest(f.request,f.scope);
  await expect(handle.readCoverage({...f.context.scope,repositoryId:'other/repo'},f.request.signal)).rejects.toThrow();
  f.revoke();await expect(handle.readCoverage(f.context.scope,f.request.signal)).rejects.toThrow();
 });
 it('refuses cancellation during the stored-plan authority await without issuing coverage',async()=>{
  const f=fixture(),abort=new AbortController();
  const request=new NextRequest(f.request.url,{signal:abort.signal});
  const handle=f.make().forRequest(request,f.scope);
  f.resolveSession.mockImplementationOnce(async()=>{abort.abort(Error('fixture_cancelled'));return{id:f.scope.sessionId,userId:f.scope.actorUserId,organizationId:f.scope.organizationId,credentialKind:'desktop_session',capabilities:['workspace:read','policy:manage','github:read','deploy:execute']}});
  await expect(handle.readCoverage(f.context.scope,request.signal)).rejects.toThrow('fixture_cancelled');
  expect(f.transport).not.toHaveBeenCalled();
 });
 it('never adopts a new equal-looking origin observation after construction',async()=>{
  const f=fixture(),handle=f.make().forRequest(f.request,f.scope);native.identity=Object.freeze({...native.identity});
  await expect(handle.readCoverage(f.context.scope,f.request.signal)).rejects.toThrow();
 });
 it('shares exact scope validation with activation and refuses outstanding metadata',async()=>{
  const f=fixture(),handle=f.make().forRequest(f.request,f.scope);
  const baseline=compileBaseline({organizationId:f.scope.organizationId,parentDigest:null,scopes:[f.context.scope],evidenceDigests:['e'.repeat(64)],rules:[{id:'approval',scope:f.context.scope,actions:['repository.merge'],decision:'require_approval',requirements:['verified_evidence'],evidenceDigests:['e'.repeat(64)]}]});
  await expect(handle.verifyBaselineActivation(f.tx as never,f.scope,baseline)).resolves.toBe(true);
  f.tx.durableAgentWorkflow.findMany.mockResolvedValue([{id:'unexpected',organizationId:f.scope.organizationId,workflowKind:'untracked'}] as never);
  await expect(handle.verifyBaselineActivation(f.tx as never,f.scope,baseline)).rejects.toThrow();
  expect(f.transport).not.toHaveBeenCalled();
 });
 it('binds actual attempt references and refuses source/transport mutation',()=>{
  const f=fixture(),handle=f.make().forRequest(f.request,f.scope);
  const attempt={operationId:releaseProviderMergeExecutionId(f.scope.organizationId,f.plan.planId),plan:f.reviewedPlan,store:{validatePrepared:vi.fn(),beforeDispatch:vi.fn(),claimWithAdmission:vi.fn(),beforeDispatchWithAdmission:vi.fn()},guard:{assert:vi.fn(),assertClaim:vi.fn(),assertFinal:vi.fn()},readCredential:vi.fn(),transport:{fetch:f.graph.transport} as never,factories:f.graph.factories};
  const fresh=handle.bindAttempt(attempt);expect(fresh).not.toThrow();
  attempt.plan={...attempt.plan,pullRequest:{...attempt.plan.pullRequest,headSha:'f'.repeat(40)}};expect(fresh).toThrow();
 });
 it('does not adopt a structurally copied registration into another composition',()=>{
  const f=fixture(),registration=f.make();
  expect(()=>assertPrivateMergeExecutionComposition(registration,f.repo as never,f.resolveSession as never,f.graph.releaseAuth,f.graph.transport)).not.toThrow();
  expect(()=>assertPrivateMergeExecutionComposition({...registration},f.repo as never,f.resolveSession as never,f.graph.releaseAuth,f.graph.transport)).toThrow();
  expect(()=>assertPrivateMergeExecutionComposition(registration,{} as never,f.resolveSession as never,f.graph.releaseAuth,f.graph.transport)).toThrow();
 });
 it('refuses a copied coverage registration at the actual coordinator boundary',()=>{
  const f=fixture(),registration=f.make();
  const dependencies={resolveSession:f.resolveSession,releaseAuth:f.graph.releaseAuth,fetch:f.graph.transport,now:()=>Date.now(),enabled:()=>true,governanceEnabled:()=>true,createGovernanceService:vi.fn(),createDrainAuthority:vi.fn(),executionCoverage:{...registration}};
  expect(()=>createReleaseProviderMergeCoordinatorCore(f.repo as never,f.request,{fetch:f.graph.transport,now:dependencies.now,useScopedInstallationTokens:true,useVerifiedLinearTopology:true,mergeTopologyPolicy:'empty_effective_target'},dependencies as never)).toThrow('governance_private_coverage_unavailable');
  expect(f.transport).not.toHaveBeenCalled();expect(f.resolveSession).not.toHaveBeenCalled();
 });
});
