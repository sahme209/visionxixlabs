import {it,expect,vi} from 'vitest';
import {createReleaseDeploymentApprovalStore,RELEASE_DEPLOYMENT_APPROVAL_KIND} from '../releaseDeploymentApprovalStore';
import {releaseDeploymentExecutionId,createReleaseDeploymentExecutionStore} from '../releaseDeploymentExecutionStore';
import {sha256ContentHash} from '../contentHash';
import type {DeploymentPlan} from '../releaseDeploymentExecutionContract';
function fixture(){
 let time=new Date('2026-10-28T22:00:00.000Z');const reviewer={organizationId:'org',actorUserId:'reviewer',sessionId:'review-session'},executor={organizationId:'org',actorUserId:'executor',sessionId:'exec-session'};
 const plan:DeploymentPlan={purpose:'release_deployment',organizationId:'org',releaseId:'release',releaseVersion:1,intakeDigest:'a'.repeat(64),planId:'release_plan_'+'b'.repeat(64),creatorUserId:'creator',requesterUserId:'requester',executorUserId:'executor',repositoryFullName:'owner/fixture',connectionId:'connection',connectionRevision:'2026-10-28T21:00:00.000Z',installationId:'123',workflowPath:'.github/workflows/deploy.yml',workflowBlobSha:'b'.repeat(40),sourceCommitSha:'a'.repeat(40),refKind:'tag',ref:'axiom-release-fixture',inputs:{},sourcePolicy:'github_protected_tag_v1',windowStart:'2026-10-28T21:59:00.000Z',expiresAt:'2026-10-28T22:20:00.000Z'};
 let rows:any[]=[],events:any[]=[],serial=Promise.resolve();
 const repo:any={
  $queryRaw:vi.fn(async(q:TemplateStringsArray,...v:any[])=>q.join('').includes('clock_timestamp')?[{live:time.getTime()<new Date(v[0]).getTime()&&(v.length<2||time.getTime()>=new Date(v[1]).getTime())}]:structuredClone(rows.filter(r=>r.id===v[0]&&r.organizationId===v[1]&&r.workflowKind===v[2]))),
  durableAgentWorkflow:{findFirst:vi.fn(async({where}:any)=>structuredClone(rows.find(r=>Object.entries(where).every(([k,v])=>r[k]===v))??null)),create:vi.fn(async({data}:any)=>{if(rows.some(r=>r.id===data.id))throw Error('duplicate');rows.push(structuredClone(data));return structuredClone(data)}),updateMany:vi.fn(async({where,data}:any)=>{const r=rows.find(r=>Object.entries(where).every(([k,v]:any)=>v&&typeof v==='object'&&'equals' in v?sha256ContentHash(r[k])===sha256ContentHash(v.equals):r[k]===v));if(!r)return{count:0};Object.assign(r,structuredClone(data),{version:r.version+1});return{count:1}})},
  durableAgentWorkflowEvent:{findMany:vi.fn(async({where}:any)=>structuredClone(events.filter(e=>e.workflowRunId===where.workflowRunId&&e.organizationId===where.organizationId))),create:vi.fn(async({data}:any)=>events.push(structuredClone(data)))}
 };
 repo.$transaction=(fn:any)=>{const pending=serial.then(async()=>{const before=structuredClone({rows,events});try{return await fn(repo)}catch(e){rows=before.rows;events=before.events;throw e}});serial=pending.catch(()=>{});return pending};
 const deps={now:()=>time,assertCurrent:vi.fn(async()=>{}),readCurrentPlan:vi.fn(async()=>plan)};
 const store=createReleaseDeploymentApprovalStore(repo,deps),nonce='00000000-0000-4000-8000-000000000001';
 const issue=()=>store.issue(reviewer,plan,nonce);
 const operation=(approval:any)=>{const id=releaseDeploymentExecutionId(plan);rows.push({id,organizationId:'org',workflowKind:'release_deployment_execution_v1',requestedByUserId:'executor',currentStep:'prepared',status:'paused_for_input',attemptCount:0,maxAttempts:1,version:0,leaseOwner:null,leaseExpiresAt:null,approvalProposalId:null,inputJson:{format:1,scope:executor,plan,planDigest:sha256ContentHash(plan),approval},stateJson:{state:'prepared'},createdAt:time,updatedAt:time});return id};
 return{repo,deps,store,reviewer,executor,plan,nonce,issue,operation,rows:()=>rows,events:()=>events,advance:()=>{time=new Date('2026-10-28T23:00:00.000Z')}};
}
it('records a genuine distinct deployment approval and immutable source digest',async()=>{const f=fixture(),a=await f.issue();expect(a.purpose).toBe('release_deployment');expect(a.approverSessionId).toBe('review-session');expect(a.planDigest).toBe(sha256ContentHash(f.plan));expect(f.events()[0]).toMatchObject({actorId:'reviewer',eventType:'release_deployment_approval.approved'});expect(f.rows()[0].workflowKind).toBe(RELEASE_DEPLOYMENT_APPROVAL_KIND)});
it.each(['creator','requester','executor'])('rejects self approval by %s',async actor=>{const f=fixture();await expect(f.store.issue({...f.reviewer,actorUserId:actor},f.plan,f.nonce)).rejects.toThrow();expect(f.rows()).toHaveLength(0)});
it('refuses missing current authority',async()=>{const f=fixture();await expect(createReleaseDeploymentApprovalStore(f.repo).issue(f.reviewer,f.plan,f.nonce)).rejects.toThrow()});
it('does not create a second approval for a replayed identical human request',async()=>{const f=fixture();expect(await f.issue()).toEqual(await f.issue());expect(f.rows()).toHaveLength(1);expect(f.events()).toHaveLength(1)});
it('rejects a different client replay nonce',async()=>{const f=fixture();await f.issue();await expect(f.store.issue(f.reviewer,f.plan,'00000000-0000-4000-8000-000000000002')).rejects.toThrow()});
it('rejects a substituted reviewer session',async()=>{const f=fixture();await f.issue();await expect(f.store.issue({...f.reviewer,sessionId:'replacement'},f.plan,f.nonce)).rejects.toThrow()});
it('rejects changed submitted plan',async()=>{const f=fixture();f.deps.readCurrentPlan.mockResolvedValue({...f.plan,sourceCommitSha:'d'.repeat(40)});await expect(f.issue()).rejects.toThrow();expect(f.rows()).toHaveLength(0)});
it('rejects expired review and never consumes it',async()=>{const f=fixture();await f.issue();f.advance();await expect(f.store.readIndependentApproval(f.repo,f.executor,f.plan)).rejects.toThrow()});
it('consumes only an exact prepared operation in the same transaction',async()=>{const f=fixture(),a=await f.issue(),id=f.operation(a);await f.repo.$transaction((tx:any)=>f.store.consumeIndependentApproval(tx,f.executor,a,id));expect(f.rows()[0]).toMatchObject({currentStep:'consumed',version:1,attemptCount:0});expect(f.events()[1].actorId).toBe('executor')});
it('refuses a fabricated operation ID',async()=>{const f=fixture(),a=await f.issue();await expect(f.store.consumeIndependentApproval(f.repo,f.executor,a,'invented')).rejects.toThrow();expect(f.rows()[0].currentStep).toBe('approved')});
it('refuses a consumed approval for a different source',async()=>{const f=fixture(),a=await f.issue(),id=f.operation(a);await f.repo.$transaction((tx:any)=>f.store.consumeIndependentApproval(tx,f.executor,a,id));await expect(f.store.readIndependentApproval(f.repo,f.executor,{...f.plan,sourceCommitSha:'e'.repeat(40)})).rejects.toThrow()});
it('requires original reviewer for revocation and retains history',async()=>{const f=fixture(),a=await f.issue();await expect(f.store.revoke(f.executor,a.id,0)).rejects.toThrow();await f.store.revoke(f.reviewer,a.id,0);expect(f.rows()[0].currentStep).toBe('revoked');expect(f.events()).toHaveLength(2);await expect(f.store.readIndependentApproval(f.repo,f.executor,f.plan)).rejects.toThrow()});
it('rejects tampered audit actor and cross-tenant reads',async()=>{const f=fixture();await f.issue();f.events()[0].actorId='executor';await expect(f.store.readIndependentApproval(f.repo,f.executor,f.plan)).rejects.toThrow();await expect(f.store.readIndependentApproval(f.repo,{...f.executor,organizationId:'other'},f.plan)).rejects.toThrow()});
it('rolls back issuance if authority changes after persistence',async()=>{const f=fixture();let n=0;f.deps.assertCurrent.mockImplementation(async()=>{if(++n>=4)throw Error('revoked')});await expect(f.issue()).rejects.toThrow();expect(f.rows()).toHaveLength(0);expect(f.events()).toHaveLength(0)});
it('connects to the existing execution store without simulation approvals',async()=>{const f=fixture();await f.issue();const execution=createReleaseDeploymentExecutionStore(f.repo,{now:f.deps.now,assertCurrent:async()=>{},readCurrentPlan:async()=>f.plan,verifySupportedSourcePolicy:async()=>({kind:'verified_release_deployment_source_policy_v1',planDigest:sha256ContentHash(f.plan),sourcePolicy:f.plan.sourcePolicy}),readIndependentApproval:f.store.readIndependentApproval,consumeIndependentApproval:f.store.consumeIndependentApproval});const prepared=await execution.prepare(f.executor,f.plan);expect(prepared.state).toBe('prepared');const claims=await Promise.all([execution.claim(f.executor,prepared.id),execution.claim(f.executor,prepared.id)]);expect(claims.filter(v=>v.claimed)).toHaveLength(1);expect(f.rows().find(r=>r.id===prepared.id).attemptCount).toBe(1)});

it('refuses approval that would expire before the deployment window opens',async()=>{const f=fixture();f.plan.windowStart='2026-10-28T22:40:00.000Z';f.plan.expiresAt='2026-10-28T23:00:00.000Z';await expect(f.issue()).rejects.toThrow();expect(f.rows()).toHaveLength(0)});

const baselineDigest='c'.repeat(64);
it('records a newly reviewed exact baseline binding and checks it again for execution',async()=>{
 const f=fixture(),assertGovernanceBaseline=vi.fn(async()=>{}),store=createReleaseDeploymentApprovalStore(f.repo,{...f.deps,assertGovernanceBaseline});
 const a=await store.issue(f.reviewer,f.plan,f.nonce,baselineDigest);
 expect(a.governanceBaselineDigest).toBe(baselineDigest);
 expect(f.events()[0].detailJson.bindingDigest).toBe(sha256ContentHash(f.rows()[0].inputJson));
 expect(await store.readIndependentApproval(f.repo,f.executor,f.plan)).toEqual(a);
 assertGovernanceBaseline.mockRejectedValue(Error('baseline_changed'));
 await expect(store.readIndependentApproval(f.repo,f.executor,f.plan)).rejects.toThrow('baseline_changed');
 expect(f.rows()[0].currentStep).toBe('approved');
});
it('refuses a bound decision without a current locked baseline verifier',async()=>{
 const f=fixture();await expect(f.store.issue(f.reviewer,f.plan,f.nonce,baselineDigest)).rejects.toThrow();expect(f.rows()).toHaveLength(0);
});
it('never retrofits a historical approval or silently removes its baseline on replay',async()=>{
 const f=fixture(),store=createReleaseDeploymentApprovalStore(f.repo,{...f.deps,assertGovernanceBaseline:async()=>{}});
 const legacy=await f.issue();expect(legacy).not.toHaveProperty('governanceBaselineDigest');
 await expect(store.issue(f.reviewer,f.plan,f.nonce,baselineDigest)).rejects.toThrow();expect(f.rows()[0].inputJson.approval).not.toHaveProperty('governanceBaselineDigest');
 const g=fixture(),bound=createReleaseDeploymentApprovalStore(g.repo,{...g.deps,assertGovernanceBaseline:async()=>{}});await bound.issue(g.reviewer,g.plan,g.nonce,baselineDigest);
 await expect(bound.issue(g.reviewer,g.plan,g.nonce)).rejects.toThrow();
 await expect(bound.issue(g.reviewer,g.plan,g.nonce,'d'.repeat(64))).rejects.toThrow();
});
it.each(['remove','replace'])('refuses %s of a saved baseline binding despite current verifier acceptance',async change=>{
 const f=fixture(),store=createReleaseDeploymentApprovalStore(f.repo,{...f.deps,assertGovernanceBaseline:async()=>{}});await store.issue(f.reviewer,f.plan,f.nonce,baselineDigest);
 if(change==='remove')delete f.rows()[0].inputJson.approval.governanceBaselineDigest;else f.rows()[0].inputJson.approval.governanceBaselineDigest='d'.repeat(64);
 await expect(store.readIndependentApproval(f.repo,f.executor,f.plan)).rejects.toThrow();
});
it('rolls back approval consumption when the baseline changes after consumption',async()=>{
 const f=fixture();let valid=true;const store=createReleaseDeploymentApprovalStore(f.repo,{...f.deps,assertGovernanceBaseline:async()=>{if(!valid)throw Error('baseline_changed');if(f.rows()[0]?.currentStep==='consumed'){valid=false;throw Error('baseline_changed')}}});
 const a=await store.issue(f.reviewer,f.plan,f.nonce,baselineDigest),id=f.operation(a);
 await expect(f.repo.$transaction((tx:any)=>store.consumeIndependentApproval(tx,f.executor,a,id))).rejects.toThrow('baseline_changed');
 expect(f.rows()[0]).toMatchObject({currentStep:'approved',version:0});expect(f.events()).toHaveLength(1);
});

it('refuses saved bound approval through an unconfigured store and preserves revocation',async()=>{
 const f=fixture(),store=createReleaseDeploymentApprovalStore(f.repo,{...f.deps,assertGovernanceBaseline:async()=>{}}),a=await store.issue(f.reviewer,f.plan,f.nonce,baselineDigest);
 await expect(f.store.readIndependentApproval(f.repo,f.executor,f.plan)).rejects.toThrow();
 await f.store.revoke(f.reviewer,a.id,0);expect(f.rows()[0].currentStep).toBe('revoked');
 expect(f.events()[1].detailJson.bindingDigest).toBe(f.events()[0].detailJson.bindingDigest);
});
it('rechecks a baseline changed by the final awaited authority check before persisting',async()=>{
 const f=fixture();let valid=true;f.deps.assertCurrent.mockImplementation(async()=>{if(f.deps.assertCurrent.mock.calls.length===3)valid=false});
 const store=createReleaseDeploymentApprovalStore(f.repo,{...f.deps,assertGovernanceBaseline:async()=>{if(!valid)throw Error('baseline_changed')}});
 await expect(store.issue(f.reviewer,f.plan,f.nonce,baselineDigest)).rejects.toThrow('baseline_changed');expect(f.rows()).toHaveLength(0);
});
it.each(['','x'.repeat(64),'c'.repeat(63)])('rejects malformed baseline digest before recording a decision',async digest=>{
 const f=fixture();await expect(f.store.issue(f.reviewer,f.plan,f.nonce,digest)).rejects.toThrow();expect(f.rows()).toHaveLength(0);
});

it('refuses when the final awaited baseline proof crosses approval expiry',async()=>{
 const f=fixture();let checks=0,crossExpiry=false;const store=createReleaseDeploymentApprovalStore(f.repo,{...f.deps,assertGovernanceBaseline:async()=>{if(crossExpiry&&++checks===2)f.advance()}});
 await store.issue(f.reviewer,f.plan,f.nonce,baselineDigest);crossExpiry=true;
 await expect(store.readIndependentApproval(f.repo,f.executor,f.plan)).rejects.toThrow();
 expect(f.rows()[0].currentStep).toBe('approved');expect(f.events()).toHaveLength(1);
});
