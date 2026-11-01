import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {createGovernanceExecutionPolicyStore} from '../executionPolicyStore';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanRow,ReleaseOperationPlanEvent} from '@/lib/agent/workflows/releaseOperationPlanStore';
const selection={repositoryId:'org/repo',resourceId:'github:repository:org/repo',environment:'production' as const};
function fixture(){
 const rows=new Map<string,ReleaseOperationPlanRow>(),events:ReleaseOperationPlanEvent[]=[];
 const owner={organizationId:'org',actorUserId:'owner',sessionId:'owner-session'},reviewer={...owner,actorUserId:'reviewer',sessionId:'reviewer-session'},executor={...owner,actorUserId:'executor',sessionId:'executor-session'};
 let expired=false,denied:string|null=null,casFailure=false;
 const matches=(row:any,where:any)=>Object.entries(where).every(([k,v])=>v&&typeof v==='object'&&'equals' in v?JSON.stringify(row[k])===JSON.stringify(v.equals):row[k]===v);
 const tx:any={
  async $queryRaw(strings:TemplateStringsArray,...values:any[]){
   const sql=strings.join('?');if(sql.includes('pg_advisory'))return[{locked:1}];
   if(sql.includes('clock_timestamp'))return[{live:!expired}];
   if(sql.includes('DurableAgentWorkflow'))return [...rows.values()].filter(r=>r.id===values[0]&&(values.length===1||r.organizationId===values[1]));
   throw Error('unexpected_query');
  },
  durableAgentWorkflow:{
   async findFirst({where}:any){return [...rows.values()].find(r=>matches(r,where))??null;},
   async create({data}:any){if(rows.has(data.id))throw Error('duplicate');const row=structuredClone(data);rows.set(row.id,row);return structuredClone(row);},
   async updateMany({where,data}:any){const r=[...rows.values()].find(r=>matches(r,where));if(!r||casFailure)return{count:0};rows.set(r.id,{...r,...data,version:r.version+1});return{count:1};},
  },
  durableAgentWorkflowEvent:{
   async findMany({where}:any){return structuredClone(events.filter(e=>matches(e,where)).sort((a,b)=>a.sequence-b.sequence));},
   async create({data}:any){events.push(structuredClone(data));},
  },
 };
 const repo={...tx,async $transaction(fn:any){const before=structuredClone([...rows.entries()]),oldEvents=structuredClone(events);try{return await fn(tx);}catch(e){rows.clear();for(const[k,v]of before)rows.set(k,v);events.splice(0,events.length,...oldEvents);throw e;}}} as ReleaseOperationPlanRepo;
 const store=createGovernanceExecutionPolicyStore(repo,{assertCurrent:async(_tx,s,actor,role)=>{
  if(s.organizationId!=='org'||s.sessionId!==s.actorUserId+'-session'||actor.sessionId!==actor.userId+'-session'||denied===actor.userId||!['owner','reviewer','executor'].includes(actor.userId)||role==='policy_admin'&&actor.userId!=='owner'||role==='approver'&&actor.userId!=='reviewer')throw Error('current_authority_refused');
 }});
 const policy=(parentDigest:string|null=null,level=4)=>({organizationId:'org',scope:selection,parentDigest,autonomyLevel:level,actions:['repository.merge'],executorUserIds:['executor'],expiresAt:new Date(Date.now()+60000).toISOString()});
 async function approved(raw=policy()){
  const proposal=await store.propose(owner,raw,randomUUID());await store.approve(reviewer,proposal.id,0,proposal.policy.digest,randomUUID());return proposal;
 }
 return{store,owner,reviewer,executor,policy,approved,rows,events,expire(){expired=true;},deny(user:string){denied=user;},failCas(){casFailure=true;}};
}
it('persists exact immutable policy, independent review and explicit activation without enrollment',async()=>{
 const f=fixture(),raw=f.policy(),nonce=randomUUID(),r=await f.store.propose(f.owner,raw,nonce);
 expect(await f.store.propose(f.owner,raw,nonce)).toEqual(r);
 await expect(f.store.propose(f.owner,raw,randomUUID())).rejects.toThrow();
 await expect(f.store.readAuthority(f.executor,selection,'repository.merge')).rejects.toThrow();
 await expect(f.store.approve(f.owner,r.id,0,r.policy.digest,randomUUID())).rejects.toThrow();
 await expect(f.store.activate(f.owner,r.id,null,null,randomUUID())).rejects.toThrow();
 const reviewNonce=randomUUID(),approved=await f.store.approve(f.reviewer,r.id,0,r.policy.digest,reviewNonce);
 expect(await f.store.approve(f.reviewer,r.id,0,r.policy.digest,reviewNonce)).toEqual(approved);
 const activationNonce=randomUUID(),active=await f.store.activate(f.owner,r.id,null,null,activationNonce);
 expect(await f.store.activate(f.owner,r.id,null,null,activationNonce)).toEqual(active);
 expect(await f.store.readAuthority(f.executor,selection,'repository.merge',r.policy.digest)).toMatchObject({autonomyLevel:4,policyDigest:r.policy.digest,executionAuthorized:false});
 expect((await f.store.readRevision(f.executor,r.id)).policy).toEqual(r.policy);
 expect([...f.rows.values()].every(row=>row.workflowKind.startsWith('governance_execution_policy_'))).toBe(true);
});
it('refuses wrong digest/version, executor review, scope/action/tenant/executor crossover and missing authority',async()=>{
 const f=fixture(),r=await f.store.propose(f.owner,f.policy(),randomUUID());
 for(const args of [[f.reviewer,1,r.policy.digest],[f.reviewer,0,'b'.repeat(64)],[f.executor,0,r.policy.digest]] as const)await expect(f.store.approve(args[0],r.id,args[1],args[2],randomUUID())).rejects.toThrow();
 await f.store.approve(f.reviewer,r.id,0,r.policy.digest,randomUUID());await f.store.activate(f.owner,r.id,null,null,randomUUID());
 for(const args of [[f.executor,{...selection,environment:'staging' as const},'repository.merge'],[f.executor,selection,'deployment.dispatch'],[f.owner,selection,'repository.merge'],[{...f.executor,organizationId:'other'},selection,'repository.merge']] as const)await expect(f.store.readAuthority(args[0],args[1],args[2])).rejects.toThrow();
 await expect(f.store.readAuthority(f.executor,selection,'repository.merge','b'.repeat(64))).rejects.toThrow();
 f.deny('reviewer');await expect(f.store.readAuthority(f.executor,selection,'repository.merge')).rejects.toThrow();
});
it('rechecks expiry, revocation, immutable history and CAS without repairing consumed or damaged records',async()=>{
 const f=fixture(),r=await f.approved();await f.store.activate(f.owner,r.id,null,null,randomUUID());
 f.expire();await expect(f.store.readAuthority(f.executor,selection,'repository.merge')).rejects.toThrow();
 const g=fixture(),a=await g.approved();await g.store.activate(g.owner,a.id,null,null,randomUUID());
 const original=structuredClone(g.rows.get(a.id)!.inputJson),revocationNonce=randomUUID();
 const revoked=await g.store.revoke(g.owner,a.id,1,revocationNonce);
 expect(await g.store.revoke(g.owner,a.id,1,revocationNonce)).toEqual(revoked);
 await expect(g.store.readAuthority(g.executor,selection,'repository.merge')).rejects.toThrow();expect(g.rows.get(a.id)!.inputJson).toEqual(original);
 const h=fixture(),b=await h.approved();h.events[0].actorId='executor';await expect(h.store.activate(h.owner,b.id,null,null,randomUUID())).rejects.toThrow();
 const j=fixture(),c=await j.store.propose(j.owner,j.policy(),randomUUID());j.failCas();await expect(j.store.approve(j.reviewer,c.id,0,c.policy.digest,randomUUID())).rejects.toThrow();expect(j.rows.get(c.id)!.version).toBe(0);
});
it('supersedes using exact parent and pointer version, and refuses stale recovery and previous revision',async()=>{
 const f=fixture(),a=await f.approved();await f.store.activate(f.owner,a.id,null,null,randomUUID());
 const b=await f.approved(f.policy(a.policy.digest,3));
 await expect(f.store.activate(f.owner,b.id,1,a.policy.digest,randomUUID())).rejects.toThrow();
 await f.store.activate(f.owner,b.id,0,a.policy.digest,randomUUID());
 expect(await f.store.readAuthority(f.executor,selection,'repository.merge')).toMatchObject({autonomyLevel:3,pointerVersion:1});
 await expect(f.store.readAuthority(f.executor,selection,'repository.merge',a.policy.digest)).rejects.toThrow();
 await expect(f.store.activate(f.owner,a.id,null,null,randomUUID())).rejects.toThrow();
});
it('binds a request nonce to one operation, exact input, actor and session across revisions',async()=>{
 const f=fixture(),requestId=randomUUID(),raw=f.policy(null,5);await f.store.propose(f.owner,raw,requestId);
 await expect(f.store.propose(f.owner,{...raw,autonomyLevel:3},requestId)).rejects.toThrow();
 const a=await f.approved(),b=await f.store.propose(f.owner,f.policy(null,3),randomUUID()),reviewNonce=randomUUID();
 // A fresh proposal gets its own independent review request.
 const c=await f.store.propose(f.owner,f.policy(null,2),randomUUID());
 await f.store.approve(f.reviewer,b.id,0,b.policy.digest,reviewNonce);
 await expect(f.store.approve(f.reviewer,c.id,0,c.policy.digest,reviewNonce)).rejects.toThrow();
 const activationNonce=randomUUID();await f.store.activate(f.owner,a.id,null,null,activationNonce);
 await expect(f.store.revoke(f.owner,a.id,1,activationNonce)).rejects.toThrow();
 const revokeNonce=randomUUID();await f.store.revoke(f.owner,a.id,1,revokeNonce);
 await expect(f.store.propose(f.owner,f.policy(null,1),revokeNonce)).rejects.toThrow();
});
it('excludes policy executors from review even when their current role otherwise permits review',async()=>{
 const f=fixture(),r=await f.store.propose(f.owner,{...f.policy(),executorUserIds:['reviewer']},randomUUID());
 await expect(f.store.approve(f.reviewer,r.id,0,r.policy.digest,randomUUID())).rejects.toThrow();
 expect((await f.store.readRevision(f.owner,r.id)).status).toBe('proposed');
});
it('refuses damaged durable request receipts instead of repeating the policy mutation',async()=>{
 const f=fixture(),raw=f.policy(),requestId=randomUUID(),r=await f.store.propose(f.owner,raw,requestId);
 const marker=[...f.rows.values()].find(x=>x.workflowKind==='governance_execution_policy_request_v1')!;
 const detail=f.events.find(e=>e.workflowRunId===marker.id)!;
 detail.actorId='reviewer';
 await expect(f.store.propose(f.owner,raw,requestId)).rejects.toThrow();
 expect(f.rows.get(r.id)!.version).toBe(0);
});
it('recovers only the exact original caller operation as inert history without another mutation',async()=>{
 const f=fixture(),nonce=randomUUID(),r=await f.store.propose(f.owner,f.policy(),nonce),count=f.rows.size,eventCount=f.events.length;
 expect(await f.store.lookupRequest(f.owner,'propose',nonce)).toEqual({found:true,result:r,historical:true,executionAuthorized:false});
 expect(f.rows.size).toBe(count);expect(f.events).toHaveLength(eventCount);
 expect(await f.store.lookupRequest(f.owner,'propose',randomUUID())).toEqual({found:false,historical:true,executionAuthorized:false});
 await expect(f.store.lookupRequest(f.reviewer,'propose',nonce)).rejects.toThrow();
 await expect(f.store.lookupRequest({...f.owner,sessionId:'other'},'propose',nonce)).rejects.toThrow();
 await expect(f.store.lookupRequest(f.owner,'activate',nonce)).rejects.toThrow();
 f.deny('owner');await expect(f.store.lookupRequest(f.owner,'propose',nonce)).rejects.toThrow();
});
it('recovers an old activation receipt after revocation without restoring its authority',async()=>{
 const f=fixture(),r=await f.approved(),nonce=randomUUID(),receipt=await f.store.activate(f.owner,r.id,null,null,nonce);
 await f.store.revoke(f.owner,r.id,1,randomUUID());const rows=structuredClone([...f.rows]);
 expect(await f.store.lookupRequest(f.owner,'activate',nonce)).toEqual({found:true,result:receipt,historical:true,executionAuthorized:false});
 await expect(f.store.readAuthority(f.executor,selection,'repository.merge')).rejects.toThrow();expect([...f.rows]).toEqual(rows);
});
it('reads the active limit pointer as non-authorizing history including revoked or expired policy',async()=>{
 const f=fixture();expect(await f.store.readActivePointer(f.owner,selection)).toEqual({found:false,scope:selection,executionAuthorized:false});
 const r=await f.approved();await f.store.activate(f.owner,r.id,null,null,randomUUID());
 expect(await f.store.readActivePointer(f.owner,selection)).toMatchObject({found:true,revisionId:r.id,digest:r.policy.digest,pointerVersion:0,policyStatus:'approved',executionAuthorized:false});
 await f.store.revoke(f.owner,r.id,1,randomUUID());f.expire();
 expect(await f.store.readActivePointer(f.owner,selection)).toMatchObject({found:true,policyStatus:'revoked',executionAuthorized:false});
 await expect(f.store.readAuthority(f.executor,selection,'repository.merge')).rejects.toThrow();
});
it('refuses damaged recovery or pointer records instead of inferring absence',async()=>{
 const f=fixture(),nonce=randomUUID();await f.store.propose(f.owner,f.policy(),nonce);
 const marker=[...f.rows.values()].find(x=>x.workflowKind==='governance_execution_policy_request_v1')!;f.events.find(e=>e.workflowRunId===marker.id)!.detailJson={};
 await expect(f.store.lookupRequest(f.owner,'propose',nonce)).rejects.toThrow();
 const g=fixture(),r=await g.approved();await g.store.activate(g.owner,r.id,null,null,randomUUID());const pointer=[...g.rows.values()].find(x=>x.workflowKind==='governance_execution_policy_active_v1')!;pointer.stateJson={};
 await expect(g.store.readActivePointer(g.owner,selection)).rejects.toThrow();
});
