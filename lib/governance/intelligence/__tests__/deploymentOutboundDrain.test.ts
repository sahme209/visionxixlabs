import {beforeEach,expect,it,vi} from 'vitest';
// SIMULATED executing identity and current request authority for source-level
// adapter tests only. No production initializer/digest injection exists.
const fixtureIdentity=vi.hoisted(()=>({digest:'c'.repeat(64),available:true}));
vi.mock('../deploymentOutboundIssuer',()=>({readDeploymentOutboundIssuerDigest:()=>{if(!fixtureIdentity.available)throw Error('SIMULATED unavailable');return fixtureIdentity.digest}}));
vi.mock('../enrollmentDrainAuthority',()=>({createEnrollmentDrainAuthority:()=>async()=>()=>{}}));
import {createDeploymentOutboundDrain} from '../deploymentOutboundDrain';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
const scope={organizationId:'org',actorUserId:'executor',sessionId:'original-session'},op='release_deployment_'+'a'.repeat(64);
const plan={purpose:'release_deployment' as const,organizationId:'org',releaseId:'release',releaseVersion:3,intakeDigest:'a'.repeat(64),planId:'reviewed-plan',creatorUserId:'creator',requesterUserId:'requester',executorUserId:'executor',repositoryFullName:'team/service',connectionId:'connection',connectionRevision:new Date().toISOString(),installationId:'123',workflowPath:'.github/workflows/deploy.yml',workflowBlobSha:'b'.repeat(40),sourceCommitSha:'c'.repeat(40),refKind:'tag' as const,ref:'v1',inputs:{environment:'production'},sourcePolicy:'genuinely-supported-test-policy',windowStart:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+60000).toISOString()};
beforeEach(()=>{fixtureIdentity.available=true;fixtureIdentity.digest='c'.repeat(64)});
function fixture(){
 let rows:any[]=[],events:any[]=[],inTransaction=false,valid=true;
 let afterCommit:(()=>void)|undefined;
 const parent=new AbortController();
 const tx:any={
  $queryRaw:async(q:TemplateStringsArray)=>q.join('').includes('clock_timestamp')?[{now:new Date()}]:[],
  durableAgentWorkflow:{
   findFirst:async({where}:any)=>structuredClone(rows.find(r=>Object.entries(where).every(([k,v])=>r[k]===v))??null),
   findMany:async({where,take}:any)=>structuredClone(rows.filter(r=>r.organizationId===where.organizationId&&r.workflowKind===where.workflowKind&&(!where.inputJson||r.inputJson.binding.operationId===where.inputJson.equals)).slice(0,take)),
   create:async({data}:any)=>{if(rows.some(r=>r.id===data.id))throw Error('duplicate');rows.push(structuredClone(data));return structuredClone(data)},
   updateMany:async({where,data}:any)=>{const r=rows.find(r=>Object.entries(where).every(([k,v]:any)=>v&&typeof v==='object'&&'equals'in v?hash(r[k])===hash(v.equals):r[k]===v));if(!r)return{count:0};Object.assign(r,structuredClone(data),{version:r.version+1});return{count:1}},
  },
  durableAgentWorkflowEvent:{
   findMany:async({where,take}:any)=>structuredClone(events.filter(e=>e.workflowRunId===where.workflowRunId&&e.organizationId===where.organizationId).slice(0,take)),
   create:async({data}:any)=>{events.push(structuredClone(data));return structuredClone(data)},
  },
 };
 const repo:any={$transaction:vi.fn(async(fn:any)=>{
  if(inTransaction)throw Error('nested transaction');inTransaction=true;
  const old=structuredClone({rows,events});let result:unknown;
  try{result=await fn(tx)}catch(e){inTransaction=false;rows=old.rows;events=old.events;throw e}
  inTransaction=false;afterCommit?.();return result;
 })};
 const claimed=vi.fn(async(t:any,s:any,id:string,p:any)=>{
  expect(t).toBe(tx);expect(inTransaction).toBe(true);
  if(!valid||hash(s)!==hash(scope)||id!==op||hash(p)!==hash(plan))throw Error('original claimed operation changed');
  return {attemptId:'original-one-attempt',targetDigest:hash({repositoryFullName:plan.repositoryFullName,workflowPath:plan.workflowPath,refKind:plan.refKind,ref:plan.ref,inputsDigest:hash(plan.inputs)}),connectionId:plan.connectionId,sourceDigest:hash(plan),fresh:()=>{if(!valid)throw Error('original authority revoked')}};
 });
 const make=()=>createDeploymentOutboundDrain(repo,{signal:parent.signal} as never,scope,op,{readClaimedOutboundLocked:claimed} as never,{signal:parent.signal,isEnabled:()=>true});
 return {make,repo,parent,rows:()=>rows,events:()=>events,claimed,revoke:()=>{valid=false},onCommit:(fn:()=>void)=>{afterCommit=fn},inTransaction:()=>inTransaction};
}
it('persists the actual attempt before credential work and consumes committed intent once, never quiescent on success',async()=>{
 const f=fixture(),adapter=f.make();await adapter.beforeCredential(plan,f.parent.signal);
 expect(f.rows()).toHaveLength(1);expect(f.rows()[0]).toMatchObject({workflowKind:'governance_outbound_v1',version:0,currentStep:'reserved'});
 expect(f.rows()[0].inputJson.binding).toMatchObject({operationId:op,attemptId:'original-one-attempt',issuerArtifactDigest:fixtureIdentity.digest,sourceDigest:hash(plan)});
 await adapter.beforeCredential(plan,f.parent.signal);expect(f.rows()).toHaveLength(1);
 const intent=await adapter.beforeSubmission(op,plan,f.parent.signal);
 expect(f.inTransaction()).toBe(false);expect(f.rows()[0]).toMatchObject({version:1,currentStep:'submission_intent'});
 expect(()=>intent()).not.toThrow();expect(()=>intent()).toThrow();
 expect(f.rows()[0].currentStep).toBe('submission_intent');expect(f.events()).toHaveLength(2);
 await expect(adapter.beforeSubmission(op,plan,f.parent.signal)).rejects.toThrow();
});
it('unavailable canonical seam refuses before transactions or slots',async()=>{
 const f=fixture();fixtureIdentity.available=false;
 const adapter=f.make();expect(()=>adapter.assertAvailable()).toThrow();
 await expect(adapter.beforeCredential(plan,f.parent.signal)).rejects.toThrow();
 expect(f.repo.$transaction).not.toHaveBeenCalled();expect(f.rows()).toHaveLength(0);
});
it('restart cannot reserve the same consumed/uncertain attempt or reset its persisted server nonce',async()=>{
 const f=fixture(),first=f.make();await first.beforeCredential(plan,f.parent.signal);const nonce=f.rows()[0].inputJson.binding.serverNonce;
 await expect(f.make().beforeCredential(plan,f.parent.signal)).rejects.toThrow();
 expect(f.rows()).toHaveLength(1);expect(f.rows()[0].inputJson.binding.serverNonce).toBe(nonce);expect(f.events()).toHaveLength(1);
});
it('lost reservation acknowledgement never causes another reservation or retry within the request',async()=>{
 const f=fixture(),adapter=f.make();f.onCommit(()=>{if(f.rows().length)throw Error('lost commit acknowledgement')});
 await expect(adapter.beforeCredential(plan,f.parent.signal)).rejects.toThrow();
 await expect(adapter.beforeCredential(plan,f.parent.signal)).rejects.toThrow();
 // Callback represents a lost reply AFTER the transaction committed.
 // The same request never retries and a new one cannot remint that attempt.
 expect(f.rows()).toHaveLength(1);expect(f.rows()[0].currentStep).toBe('reserved');
 expect(f.events()).toHaveLength(1);expect(f.claimed).toHaveBeenCalledTimes(2);
});
it('original authority revoked after intent commit withholds physical submission but retains the blocker',async()=>{
 const f=fixture(),adapter=f.make();await adapter.beforeCredential(plan,f.parent.signal);
 f.onCommit(()=>{if(f.rows()[0]?.currentStep==='submission_intent')f.revoke()});
 await expect(adapter.beforeSubmission(op,plan,f.parent.signal)).rejects.toThrow();
 expect(f.rows()[0]).toMatchObject({currentStep:'submission_intent',version:1});
});
it('caller cancellation and a changed issuer withhold private reuse without changing history',async()=>{
 const f=fixture(),adapter=f.make(),caller=new AbortController();await adapter.beforeCredential(plan,caller.signal);
 caller.abort();await expect(adapter.beforeCredential(plan,new AbortController().signal)).rejects.toThrow();
 const g=fixture(),other=g.make();await other.beforeCredential(plan,g.parent.signal);fixtureIdentity.digest='d'.repeat(64);
 await expect(other.beforeCredential(plan,g.parent.signal)).rejects.toThrow();
 await expect(other.beforeSubmission(op,plan,g.parent.signal)).rejects.toThrow();
 expect(g.rows()[0].currentStep).toBe('reserved');expect(g.events()).toHaveLength(1);
});
it('does not accept a swapped plan, operation or original scope to adopt the slot',async()=>{
 const f=fixture(),adapter=f.make();await adapter.beforeCredential(plan,f.parent.signal);
 await expect(adapter.beforeCredential({...plan,connectionId:'other'},f.parent.signal)).rejects.toThrow();
 await expect(adapter.beforeSubmission('release_deployment_'+'b'.repeat(64),plan,f.parent.signal)).rejects.toThrow();
 expect(f.rows()[0].currentStep).toBe('reserved');expect(f.events()).toHaveLength(1);
});
