import {afterEach, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';
import {createPrivateReleaseMergeDataDispatcher} from '../privateReleaseMergeRequestData';
vi.mock('@/lib/db',()=>{throw Error('legacy_database_import_forbidden')});
vi.mock('../resolveRequestDesktopSession',()=>{throw Error('legacy_session_import_forbidden')});
vi.mock('../releaseProviderMergeCoordinator',()=>{throw Error('legacy_coordinator_import_forbidden')});
import {createPrivateAuthorityDatabase} from '@/lib/security/privateAuthorityDatabase';
import {createPrivateCredentialVault} from '@/lib/security/privateCredentialVault';
import {createPrivateDesktopTokenCodec} from '../privateDesktopToken';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {createPrivateReleaseMergeComposition} from '../privateReleaseMergeComposition';
afterEach(()=>vi.restoreAllMocks());
const planId='release_plan_'+'a'.repeat(64);
const plan={kind:'merge_pull_request',organizationId:'org',requestId:'release',requestVersion:3,intakeDigest:'d'.repeat(64),connectionId:'connection',connectionRevision:'2030-01-01T00:00:00Z',window:{startUtc:'2030-01-02T00:00:00Z',endUtc:'2030-01-03T00:00:00Z'},method:'squash',pullRequest:{repositoryFullName:'team/service',number:42,url:'https://github.com/team/service/pull/42',headRef:'feature',headSha:'a'.repeat(40),baseRef:'main',baseSha:'b'.repeat(40)}};

function setup(){
 const client=createPrivateAuthorityDatabase('postgresql://synthetic:synthetic@127.0.0.1:1/private_fixture');
 const now=Date.parse('2026-11-05T00:00:00Z'),key=new Uint8Array(32).fill(7);
 const token=createPrivateDesktopTokenCodec(key).mintDesktopToken('dsk_owned');
 const session=vi.spyOn(client.desktopSessionRecord,'findUnique').mockResolvedValue({id:'dsk_owned',userId:'user',organizationId:'org',deviceFingerprint:'owned',deviceLabel:'Owned test',platform:'unknown',desktopVersion:null,createdAt:new Date(now),issuedAt:new Date(now),expiresAt:new Date(now+60000),lastSeenAt:new Date(now),revokedAt:null,revokeReason:null});
 const membership=vi.spyOn(client.orgMembership,'findUnique').mockResolvedValue({role:'admin',acceptedAt:new Date(now)} as never);
 vi.spyOn(client.tenantBillingPlan,'findUnique').mockResolvedValue({organizationId:'org',tier:'growth',status:'active',trialEndsAt:null,currentPeriodEndsAt:null,stripeCustomerId:null,stripeSubscriptionId:null,cancelAtPeriodEnd:false} as never);
 vi.spyOn(client.desktopSessionRecord,'update').mockResolvedValue({} as never);
 const input={format:1,plan,planDigest:sha256ContentHash(plan),releaseRequesterUserId:'requester',createdAt:'2030-01-01T00:00:00Z',deadlineAt:plan.window.endUtc};
 const find=vi.spyOn(client.durableAgentWorkflow,'findFirst').mockResolvedValue(null);
 find.mockResolvedValueOnce({inputJson:input} as never);
 const transaction=vi.spyOn(client,'$transaction'),credential=vi.spyOn(client.platformGithubAppCredential,'findUnique'),transport=vi.fn();
 const composition=createPrivateReleaseMergeComposition({client,vault:createPrivateCredentialVault(new Uint8Array(32).fill(8)),sessionSigningKey:key,billing:{kind:'legacy'},fetch:transport as typeof fetch,now:()=>now,enabled:()=>true,governanceEnabled:()=>true});
 const request=(suffix:string,authorization=`Bearer ${token}`)=>new NextRequest(`https://private.invalid/api/desktop/deployments/release/operation-plans/${planId}/${suffix}`,{headers:{authorization}});
 return {client,composition,session,membership,find,transaction,credential,transport,request};
}
it('execution handler resolves actual private session and looks only in its private tenant store',async()=>{
 const f=setup();try{
 const response=await f.composition.handleExecution(f.request('provider-execution'),'release',planId);
 expect(response.status).toBe(200);expect((await response.json()).data.available).toBe(true);expect(f.session).toHaveBeenCalled();expect(f.membership).toHaveBeenCalled();
 expect(f.find).toHaveBeenCalledWith({where:{id:planId,organizationId:'org',workflowKind:'release_operation_plan_v1'}});
 expect(f.transaction).not.toHaveBeenCalled();expect(f.credential).not.toHaveBeenCalled();expect(f.transport).not.toHaveBeenCalled();
 }finally{await f.client.$disconnect()}
});
it('history handler stays private and cannot mint or dispatch',async()=>{
 const f=setup();try{const response=await f.composition.handleOperation(f.request('provider-operation'),'release',planId);expect(response.status).toBe(200);expect(f.find).toHaveBeenCalled();expect(f.transaction).not.toHaveBeenCalled();expect(f.credential).not.toHaveBeenCalled();expect(f.transport).not.toHaveBeenCalled()}finally{await f.client.$disconnect()}
});
it('API keys cannot reach either private handler store',async()=>{
 const f=setup();try{expect((await f.composition.handleExecution(f.request('provider-execution','Bearer vxlk_test'),'release',planId)).status).toBe(403);expect((await f.composition.handleOperation(f.request('provider-operation','Bearer vxlk_test'),'release',planId)).status).toBe(401);expect(f.session).not.toHaveBeenCalled();expect(f.find).not.toHaveBeenCalled();expect(f.transport).not.toHaveBeenCalled()}finally{await f.client.$disconnect()}
});
it('removed membership refuses before plan access in both private handlers',async()=>{
 const f=setup();f.membership.mockResolvedValue(null);try{expect((await f.composition.handleExecution(f.request('provider-execution'),'release',planId)).status).toBe(403);expect((await f.composition.handleOperation(f.request('provider-operation'),'release',planId)).status).toBe(401);expect(f.find).not.toHaveBeenCalled();expect(f.credential).not.toHaveBeenCalled();expect(f.transport).not.toHaveBeenCalled()}finally{await f.client.$disconnect()}
});

it('HTTP preparation rejects a different release binding before any transaction or credential',async()=>{
 const f=setup();try{
 const original=f.request('provider-execution');
 const request=new NextRequest(original.url,{method:'POST',headers:{authorization:original.headers.get('authorization')!,'content-type':'application/json'},body:JSON.stringify({action:'prepare',expectedVersion:0,clientRequestId:'11111111-1111-4111-8111-111111111111'})});
 const response=await f.composition.handleExecution(request,'other',planId);
 expect(response.status).toBe(409);expect(f.transaction).not.toHaveBeenCalled();expect(f.credential).not.toHaveBeenCalled();expect(f.transport).not.toHaveBeenCalled();
 }finally{await f.client.$disconnect()}
});

it('data envelope reaches the actual private handler graph without importing global resources',async()=>{
 const f=setup();try{
 const original=f.request('provider-execution');
 const dispatch=createPrivateReleaseMergeDataDispatcher({execution:f.composition.handleExecution,operation:f.composition.handleOperation});
 const bytes=new TextEncoder().encode(JSON.stringify({protocol:'axiom.issuer-request/1',operation:'read_execution',requestId:'release',planId,authorization:original.headers.get('authorization')!.slice(7)}));
 const response=await dispatch(bytes,new AbortController().signal);
 expect(response.status).toBe(200);expect(JSON.parse(new TextDecoder().decode(response.body)).data.operation).toBeNull();expect(f.find).toHaveBeenCalled();expect(f.transaction).not.toHaveBeenCalled();expect(f.credential).not.toHaveBeenCalled();expect(f.transport).not.toHaveBeenCalled();
 }finally{await f.client.$disconnect()}
});
