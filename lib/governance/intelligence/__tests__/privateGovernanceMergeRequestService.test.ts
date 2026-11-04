import {expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {createPrivateGovernanceMergeRequestService} from '../privateGovernanceMergeRequestService';
const scope={organizationId:'org',actorUserId:'actor',sessionId:'session'};
function fixture(enabled=true){
 let member=true,live=true;const rows:any[]=[];
 const tx={$queryRaw:vi.fn(async(sql:TemplateStringsArray,..._values:unknown[])=>{const q=sql.join('');if(q.includes('OrgMembership'))return member?[{organizationId:'org',userId:'actor',role:'admin',acceptedAt:new Date()}]:[];if(q.includes('DesktopSessionRecord'))return[{id:'session',organizationId:'org',userId:'actor',live}];return[]}),durableAgentWorkflow:{findMany:vi.fn(async()=>rows),findFirst:vi.fn(async()=>null)}};
 const repo={...tx,$transaction:async(fn:any)=>fn(tx)};
 const resolveSession=vi.fn(async()=>({id:'session',userId:'actor',organizationId:'org',credentialKind:'desktop_session' as const,role:'admin' as const,capabilities:[]}));
 const fetcher=vi.fn(),mint=vi.fn();
 const service=createPrivateGovernanceMergeRequestService(new NextRequest('https://local.test/governance'),repo as never,scope,()=>enabled,{resolveSession,githubAuth:{resolveReleaseInstallationToken:mint},fetch:fetcher,now:Date.now});
 return{service,tx,rows,resolveSession,fetcher,mint,revoke(){live=false},remove(){member=false}};
}
it('uses captured paired identity and locked membership for disabled enrollment safety fences',async()=>{
 const f=fixture(false);expect(await f.service.hasAnyEnrollment()).toBe(false);expect(await f.service.readAnyEnrollmentLocked(f.tx as never)).toBe(false);
 expect(f.resolveSession).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({allowApiKey:false,recordHeartbeat:false}));
 f.rows.push({id:'governance_active_existing',organizationId:'org',workflowKind:'governance_baseline_active_v1'});expect(await f.service.hasAnyEnrollment()).toBe(true);
 f.revoke();await expect(f.service.hasAnyEnrollment()).rejects.toThrow('governance_authority_required');expect(f.fetcher).not.toHaveBeenCalled();expect(f.mint).not.toHaveBeenCalled();
});
it('refuses lost membership and malformed tenant enrollment instead of reporting absence',async()=>{
 const f=fixture();f.rows.push({id:'other',organizationId:'other',workflowKind:'governance_baseline_active_v1'});await expect(f.service.hasAnyEnrollment()).rejects.toThrow('governance_enrollment_unavailable');
 f.remove();await expect(f.service.readAnyEnrollmentLocked(f.tx as never)).rejects.toThrow('governance_authority_required');
});
it('explicitly rejects AWS evidence selection without provider or credential access',async()=>{
 const f=fixture();await expect(f.service.collect({organizationId:'org',source:'aws',connectionId:'account',connectionRevision:'a'.repeat(64),selection:{repositoryId:'team/repo',resourceId:'aws:account:123456789012:region:us-east-1',environment:'production'},operations:['iam.roles']},'f1af65d8-fcad-42d0-a8ef-806fb63735ac')).rejects.toThrow('governance_private_merge_aws_evidence_unsupported');
 expect(f.fetcher).not.toHaveBeenCalled();expect(f.mint).not.toHaveBeenCalled();
});

import {createGovernanceEvidenceStore} from '../evidenceStore';
import {parseEvidenceSnapshot} from '../contracts';
it('retains actual immutable GitHub history and explicitly refuses stored AWS evidence',async()=>{
 const f=fixture(),savedRows:any[]=[],events:any[]=[];
 const query=f.tx.$queryRaw.getMockImplementation()!,revision=new Date().toISOString();
 f.tx.$queryRaw.mockImplementation(async(sql,...values:any[])=>sql.join('').includes('FROM "DurableAgentWorkflow"')?savedRows.filter(r=>r.id===values[0]):sql.join('').includes('FROM "GitHubInstallation"')?[{id:'connection',organizationId:'org',githubInstallationId:'123',updatedAt:new Date(revision),status:'active',revokedAt:null,suspendedAt:null}]:query(sql,...values));
 Object.assign(f.tx.durableAgentWorkflow,{findFirst:async({where}:any)=>savedRows.find(r=>r.id===where.id)??null,create:async({data}:any)=>{savedRows.push(data);return data}});
 Object.assign(f.tx,{durableAgentWorkflowEvent:{create:async({data}:any)=>{events.push(data);return data},findMany:async({where}:any)=>events.filter(e=>e.workflowRunId===where.workflowRunId)}});
 const store=createGovernanceEvidenceStore({$transaction:async(fn:any)=>fn(f.tx)} as never,{assertCurrent:async()=>{}});
 const snapshot=(source:'github'|'aws')=>parseEvidenceSnapshot({organizationId:'org',source,connectionId:'connection',connectionRevision:'revision',collectorVersion:'governance-discovery-read-v1',collectionOperations:source==='github'?['repository.identity']:['iam.roles'],selection:{repositoryId:'team/repo',resourceId:source==='github'?'github:repository:team/repo':'aws:account:123456789012:region:us-east-1',environment:'production'},observedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),completeness:'complete',sourceDigest:'a'.repeat(64),facts:[]});
 const github=await store.save(scope,snapshot('github'),'f1af65d8-fcad-42d0-a8ef-806fb63735ac');expect((await f.service.readEvidence(github.snapshot.digest)).snapshot).toEqual(github.snapshot);
 const aws=await store.save(scope,snapshot('aws'),'f1af65d8-fcad-42d0-a8ef-806fb63735ac');await expect(f.service.readEvidence(aws.snapshot.digest)).rejects.toThrow('governance_private_merge_aws_evidence_unsupported');
 expect(savedRows).toHaveLength(2);expect(events).toHaveLength(2);
 const document=await f.service.uploadDocument({name:'policy.md',selection:{repositoryId:'team/repo',resourceId:'github:repository:team/repo',environment:'production'},utf8Bytes:new TextEncoder().encode('Releases require independent approval.'),expectedVersion:null,requestId:'99dd613f-c4c8-4275-900d-3e06dc0b5c4f'});
 expect(document.snapshot.source).toBe('document');expect((await f.service.readEvidence(document.snapshot.digest)).snapshot).toEqual(document.snapshot);expect(document.headVersion).toBe(0);
 expect(savedRows.map(r=>r.workflowKind)).toContain('governance_document_head_v1');
 // Stored bytes are independently rechecked against the actual current head.
 const {assertGovernanceDocumentHead}=await import('../documentStore');await assertGovernanceDocumentHead(f.tx as never,scope,document.snapshot);
 f.mint.mockResolvedValue({token:'synthetic-local-token',expiresAt:Date.now()+60000,permissions:{administration:'read',contents:'read',metadata:'read'}});
 f.fetcher.mockResolvedValue(Response.json({id:123,full_name:'team/repo',default_branch:'main'}));
 const collected=await f.service.collect({organizationId:'org',source:'github',connectionId:'connection',connectionRevision:revision,selection:{repositoryId:'team/repo',resourceId:'github:repository:team/repo',environment:'production'},operations:['repository.identity']},'56958d61-5662-43b6-8dc0-b8d25e51bf32');
 expect(collected.snapshot.completeness).toBe('complete');expect((await f.service.readEvidence(collected.snapshot.digest)).snapshot).toEqual(collected.snapshot);
 expect(f.mint).toHaveBeenCalledWith(expect.objectContaining({purpose:'source_policy_read',repositoryFullName:'team/repo'}),expect.any(AbortSignal));expect(f.fetcher).toHaveBeenCalledOnce();
 const baselineInput=(artifact:typeof document)=>({organizationId:'org',parentDigest:null,scopes:[artifact.snapshot.selection],evidenceDigests:[artifact.snapshot.digest],rules:[{id:'merge-rule',actions:['repository.merge'],scope:artifact.snapshot.selection,decision:'require_approval',requirements:[],evidenceDigests:[artifact.snapshot.digest]}]});
 const proposal=await f.service.propose(baselineInput(document),'48577308-4ffe-4ebf-bcee-f54122a04275');expect(proposal.status).toBe('proposed');expect((await f.service.readDrift(proposal.id)).status).toBe('unchanged');
 await expect(f.service.propose(baselineInput({...document,snapshot:aws.snapshot}),'a2e0ca6d-d0b4-41cf-8b60-90de77e6d58d')).rejects.toThrow('governance_private_merge_aws_evidence_unsupported');
 f.remove();await expect(f.service.readEvidence(document.snapshot.digest)).rejects.toThrow();
});

import {createEnrollmentDrainAuthorityCore} from '../enrollmentDrainAuthorityCore';
it('binds drain freshness to captured session and clock without replacing original participant checks',async()=>{
 let at=Date.now();const caller={organizationId:'org',actorUserId:'admin',sessionId:'admin-session'},subject={organizationId:'org',actorUserId:'reviewer',sessionId:'reviewer-session'};
 const resolver=vi.fn(async()=>({id:caller.sessionId,userId:caller.actorUserId,organizationId:'org',credentialKind:'desktop_session' as const,role:'admin' as const,capabilities:['policy:manage' as const]}));
 const tx={$queryRaw:async(_sql:any,...v:any[])=>[{organizationId:v[0],userId:v[1],role:v[1]==='reviewer'?'security_reviewer':'admin',acceptedAt:new Date(at),sessionId:v[2],sessionOrganizationId:v[0],sessionUserId:v[1],expiresAt:new Date(at+60000),live:true}]};
 const authority=createEnrollmentDrainAuthorityCore(new NextRequest('https://local.test/drain'),{resolveSession:resolver,now:()=>at});
 const fresh=await authority(tx as never,caller,'administrator',subject,'reviewer');fresh();at+=15000;expect(fresh).toThrow('enrollment_drain_authority_unavailable');
 expect(resolver).toHaveBeenCalledTimes(2);await expect(authority(tx as never,caller,'administrator',{...subject,actorUserId:'admin'},'reviewer')).rejects.toThrow('enrollment_drain_authority_unavailable');
});
