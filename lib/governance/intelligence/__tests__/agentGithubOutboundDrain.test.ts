import {beforeEach,expect,it,vi} from 'vitest';
// SIMULATED executing identity and current request authority for source-level
// adapter tests only. No production initializer/digest injection exists.
const fixtureIdentity=vi.hoisted(()=>({digest:'c'.repeat(64),available:true}));
vi.mock('../agentGithubOutboundIssuer',()=>({readAgentGithubOutboundIssuerDigest:()=>{if(!fixtureIdentity.available)throw Error('SIMULATED unavailable');return fixtureIdentity.digest}}));
vi.mock('../enrollmentDrainAuthority',()=>({createEnrollmentDrainAuthority:()=>async()=>()=>{}}));
import {createAgentGithubOutboundDrain} from '../agentGithubOutboundDrain';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
const scope={organizationId:'org',actorUserId:'executor',sessionId:'original-session'},op='agent_execution_'+'a'.repeat(64);
const source={toolName:'create_github_branch',args:{repositoryFullName:'team/service'},proposalDigest:'f'.repeat(64),reviewId:'original-review'},connection={id:'connection',githubInstallationId:'123',updatedAt:new Date()},target:any={kind:'ecs_restart_target',organizationId:'org',environmentId:'env',environmentTier:'qa',targetId:'target',provider:'aws',targetUpdatedAt:new Date().toISOString(),roleArn:'role',region:'region',ecsCluster:'cluster',ecsService:'service'},privateClaim={operationId:op},final={policySnapshotDigest:'f'.repeat(64),sourceCommitSha:'a'.repeat(40)};
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
 const claimed=vi.fn(async(t:any,s:any,proof:any,input:any)=>{
  expect(t).toBe(tx);expect(inTransaction).toBe(true);
  if(!valid||hash(s)!==hash(scope)||proof!==privateClaim||hash(input.source)!==hash(source)||hash(input.connection)!==hash(connection))throw Error('original private claim changed');
  return{profile:'agent.github_create_branch.v1',attemptId:'original-private-attempt',targetDigest:hash(target),connectionId:connection.id,sourceDigest:hash(source),fresh:()=>{if(!valid)throw Error('original authority revoked')}};
 });
 const make=()=>createAgentGithubOutboundDrain(repo,{signal:parent.signal} as never,scope,op,{readClaimedGithubOutboundLocked:claimed} as never,source,connection);

 return {make,repo,parent,rows:()=>rows,events:()=>events,claimed,revoke:()=>{valid=false},onCommit:(fn:()=>void)=>{afterCommit=fn},inTransaction:()=>inTransaction};
}

it('reserves once before credentials, persists association and consumes final intent once without quiescence',async()=>{
 const f=fixture(),adapter=f.make();await adapter.beforeCredential(privateClaim);await adapter.beforeCredential(privateClaim);expect(f.rows()).toHaveLength(1);expect(f.rows()[0]).toMatchObject({currentStep:'reserved',version:0});
 const intent=await adapter.beforeSubmission();expect(f.inTransaction()).toBe(false);expect(f.rows()[0]).toMatchObject({currentStep:'submission_intent',version:1});expect(()=>intent()).not.toThrow();expect(()=>intent()).toThrow();expect(f.events()).toHaveLength(2);await expect(adapter.beforeSubmission()).rejects.toThrow();
});
it('refuses a logical operation mismatch before private claim validation, reservation or mint',async()=>{const f=fixture(),adapter=f.make();await expect(adapter.beforeCredential({operationId:'agent_execution_'+'b'.repeat(64)})).rejects.toThrow();expect(f.repo.$transaction).not.toHaveBeenCalled();expect(f.rows()).toHaveLength(0)});
it('refuses canonical unavailable before any reservation',async()=>{const f=fixture();fixtureIdentity.available=false;expect(()=>f.make().assertAvailable()).toThrow();await expect(f.make().beforeCredential(privateClaim)).rejects.toThrow();expect(f.repo.$transaction).not.toHaveBeenCalled()});
it('never remints on lost reservation acknowledgement or restart',async()=>{const f=fixture(),adapter=f.make();f.onCommit(()=>{if(f.rows().length)throw Error('SIMULATED lost committed ack')});await expect(adapter.beforeCredential(privateClaim)).rejects.toThrow();await expect(adapter.beforeCredential(privateClaim)).rejects.toThrow();expect(f.rows()).toHaveLength(1);expect(f.rows()[0].currentStep).toBe('reserved');await expect(f.make().beforeCredential(privateClaim)).rejects.toThrow();expect(f.rows()).toHaveLength(1)});
it('revocation after intent commit withholds POST while preserving the durable blocker',async()=>{const f=fixture(),adapter=f.make();await adapter.beforeCredential(privateClaim);f.onCommit(()=>{if(f.rows()[0]?.currentStep==='submission_intent')f.revoke()});await expect(adapter.beforeSubmission()).rejects.toThrow();expect(f.rows()[0]).toMatchObject({currentStep:'submission_intent',version:1})});
it('changed issuer, policy or cancellation cannot adopt or clear the original slot',async()=>{const f=fixture(),adapter=f.make();await adapter.beforeCredential(privateClaim);fixtureIdentity.digest='d'.repeat(64);await expect(adapter.beforeSubmission()).rejects.toThrow();f.parent.abort();await expect(adapter.beforeCredential(privateClaim)).rejects.toThrow();expect(f.rows()[0].currentStep).toBe('reserved');expect(f.events()).toHaveLength(1)});
