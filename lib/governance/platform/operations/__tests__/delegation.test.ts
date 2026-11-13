import {it,expect,vi} from 'vitest';
import {createOperationalDelegationStore as createOperationalDelegationStoreActual,type OperationalCredentialIssuer} from '../delegation';
import {nativeEcsTargetKey} from '../reservationStore';
import {compileOperationalManifest} from '../kernel';
import {compilePlatformPlan,createPlatformAction,approvePlatformAction} from '../../kernel';
import type {OperationalDelegationRepository,OperationalDelegationTransaction} from '../delegationContract';
import type {createOperationalWorkloadIdentity} from '../workloadIdentity';
const now=Date.parse('2026-11-12T00:00:00Z'),d='a'.repeat(64),commit='b'.repeat(40),id='platform_action_11111111-1111-4111-8111-111111111111',requester={userId:'requester',sessionId:'requester-session'},reviewer={userId:'reviewer',sessionId:'reviewer-session'};
// Explicit synthetic decision time only; native qualification remains unavailable.
function createOperationalDelegationStore(...args:Parameters<typeof createOperationalDelegationStoreActual>){
 const [repo,authority,source,identity,targets,issuer,transport,intents]=args;
 return createOperationalDelegationStoreActual(repo,authority,{...source,readTimeWindow:async(_tx,m)=>({manifestDigest:m.digest,sourceEvidenceId:m.sourceEvidenceId,profileDigest:d,notBefore:now,expiresAt:now+600000})},identity,targets,issuer,transport,intents,{clock:async()=>({earliest:now,latest:now}),signal:new AbortController().signal});
}
function fixture(issuer?:OperationalCredentialIssuer){
 const manifest=compileOperationalManifest({format:1,scope:'platform',kind:'deployment.ecs',operation:'force',expiresAt:new Date(now+300000).toISOString(),target:{accountId:'123456789012',region:'us-east-2',clusterArn:'arn:aws:ecs:us-east-2:123456789012:cluster/fixture',serviceArn:'arn:aws:ecs:us-east-2:123456789012:service/fixture/service',taskDefinitionArn:'arn:aws:ecs:us-east-2:123456789012:task-definition/service:2'},roleArn:'arn:aws:iam::123456789012:role/fixture',workload:{repository:'sahme209/visionxixlabs',ref:'refs/heads/main',commit,workflowCommit:commit,workflowPath:'.github/workflows/axiom-deploy-aws-ecs.yml',workflowSha256:d,runId:'12345',attempt:1},sourceEvidenceId:'platform_evidence_11111111-1111-4111-8111-111111111111'});if(manifest.kind!=='deployment.ecs')throw Error('fixture');
 const plan=compilePlatformPlan({format:1,scope:'platform',sourceDigest:manifest.digest,expiresAt:manifest.expiresAt,effects:[{id:'ecs',kind:'deployment.ecs',target:{accountId:manifest.target.accountId,region:manifest.target.region,cluster:manifest.target.clusterArn,service:manifest.target.serviceArn,taskDefinitionArn:manifest.target.taskDefinitionArn,operation:'force',configurationDigest:manifest.digest}}]});
 let parent=approvePlatformAction(createPlatformAction(plan,requester,now),{...reviewer,planDigest:plan.digest},now),delegation:unknown=null,events:unknown[]=[],tail=Promise.resolve(),clock=now,failEvent=false,loseAck=false;const revoked=new Set<string>();
 const replays=new Map<string,string>();
 const repo:OperationalDelegationRepository={transaction:async fn=>{const wait=tail;let release!:()=>void;tail=new Promise(r=>{release=r});await wait;let p=parent,record=delegation;const nextEvents=[...events],nextReplays=new Map(replays);
  const tx:OperationalDelegationTransaction={readEcsManifest:async()=>{throw Error('unused fixture port')},readOperationalFailureReceipt:async()=>null,readOperationalEcsResult:async()=>{throw Error('unused fixture port')},readOperationalCredentialLiability:async()=>{throw Error('not used')},lockOperationalTarget:async()=>{},readOperationalTarget:async()=>null,insertOperationalTarget:async()=>{throw Error('not used')},replaceOperationalTarget:async()=>{throw Error('not used')},readOperationalTargetReceipt:async()=>null,insertOperationalTargetReceipt:async()=>{throw Error('not used')},lock:async()=>{},now:async()=>clock,read:async()=>p,readPrincipal:async p=>({...p,live:true,sessionIssuedAtMs:now,sessionExpiresAtMs:now+600000}),readSessionPrincipal:async()=>null,insert:async()=>{throw Error('not used')},replace:async(_id,version,state)=>{if(p.version!==version)throw Error('stale');p=state},event:async e=>{if(failEvent)throw Error('event');nextEvents.push(e)},readGrowthPostingSource:async()=>null,readEffect:async()=>null,writeEffect:async()=>{},readDelegation:async()=>record,insertDelegation:async(_id,state)=>{if(record)throw Error('duplicate');record=state},replaceDelegation:async(_id,version,state)=>{if((record as {version:number}).version!==version)throw Error('stale');record=state},reserveWorkloadIdentity:async(key,actionId)=>{if(nextReplays.has(key))throw Error('replay');nextReplays.set(key,actionId)}};
  try{const result=await fn(tx);parent=p;delegation=record;events=nextEvents;replays.clear();for(const[k,v]of nextReplays)replays.set(k,v);if(loseAck&&(record as {version?:number}|null)?.version===1)throw Error('commit acknowledgement lost');return result}finally{release()}
 }};
 const authority={assertCurrent:vi.fn(async(_tx:unknown,p:typeof requester)=>{if(revoked.has(p.userId))throw Error('revoked')})},source={readManifest:vi.fn(async()=>manifest),assertCurrent:vi.fn(async()=>{})};
 const identity:Pick<ReturnType<typeof createOperationalWorkloadIdentity>,'authenticate'|'consume'|'assertConsumedCurrent'>={authenticate:vi.fn(async()=>Object.freeze({})),assertConsumedCurrent:vi.fn(async()=>{}),consume:vi.fn(async(tx,_proof,binding)=>{await tx.reserveWorkloadIdentity(d,id,manifest.digest);return {principalKind:'workload' as const,actionId:id,manifestDigest:manifest.digest,workload:manifest.workload,replayKey:d,profileDigest:d,expiresAt:now+120000,authority:'identity_only' as const,executionAuthorized:false as const}})};
 const store=createOperationalDelegationStore(repo,authority,source,identity,{reserve:async()=>({nativeKey:nativeEcsTargetKey(manifest.target),generation:1}),assertHeld:async()=>{}},issuer);
 return {store,repo,manifest,plan,identity,source,events:()=>events,parent:()=>parent,record:()=>delegation,revoked,setNow:(v:number)=>{clock=v},failEvents:()=>{failEvent=true},loseClaimAck:()=>{loseAck=true}};
}
it('requires original-session delegation and records a distinct one-use workload claim rather than a human execution',async()=>{
 const f=fixture();await expect(f.store.delegate(id,1,f.plan.digest,reviewer)).rejects.toThrow();await expect(f.store.delegate(id,1,f.plan.digest,{...requester,sessionId:'other'})).rejects.toThrow();
 await f.store.delegate(id,1,f.plan.digest,requester);const result=await Promise.allSettled([f.store.claim(id,0,'synthetic-jwt'),f.store.claim(id,0,'synthetic-jwt')]);expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(f.parent()).toMatchObject({status:'claimed',attemptCount:1});
 const view=await f.store.inspect(id,requester);expect(view).toMatchObject({version:1,status:'claimed',attemptCount:1,executionPrincipal:{kind:'workload'},credential:{status:'not_requested'},providerExecution:false,executionAuthorized:false});expect(JSON.stringify(view)).not.toContain(requester.sessionId);expect(f.events()).toHaveLength(2);
});
it('retains a claimed delegation after lost commit acknowledgement and cannot repeat it',async()=>{
 const f=fixture();await f.store.delegate(id,1,f.plan.digest,requester);f.loseClaimAck();await expect(f.store.claim(id,0,'synthetic-jwt')).rejects.toThrow('operational_delegation_unconfirmed');expect(f.parent()).toMatchObject({status:'claimed',attemptCount:1});await expect(f.store.claim(id,0,'synthetic-jwt')).rejects.toThrow();expect(f.identity.authenticate).toHaveBeenCalledTimes(1);
});
it('checks both actual human roles/source/expiry before workload authentication',async()=>{
 for(const cause of ['reviewer','source','expiry']){const f=fixture();await f.store.delegate(id,1,f.plan.digest,requester);if(cause==='reviewer')f.revoked.add(reviewer.userId);if(cause==='source')f.source.assertCurrent.mockRejectedValue(Error('source'));if(cause==='expiry')f.setNow(now+300000);await expect(f.store.claim(id,0,'synthetic-jwt')).rejects.toThrow();expect(f.identity.authenticate).not.toHaveBeenCalled();expect(f.parent()).toMatchObject({status:'approved',attemptCount:0})}
});
it('persists credential liability before issuance and accepts one observation without restoring authority after revocation',async()=>{
 const f=fixture();await f.store.delegate(id,1,f.plan.digest,requester);const claimed=await f.store.claim(id,0,'synthetic-jwt'),pending=await f.store.beginCredential(claimed.proof);await expect(f.store.beginCredential(claimed.proof)).rejects.toThrow();expect(await f.store.inspect(id,requester)).toMatchObject({version:2,credential:{status:'pending'}});
 f.revoked.add(reviewer.userId);f.setNow(now+400000);await f.store.observeCredential(pending.proof,{status:'issued',leaseRef:'platform_credential_11111111-1111-4111-8111-111111111111',expiresAt:now+900000});const view=await f.store.inspect(id,requester);expect(view).toMatchObject({version:3,credential:{status:'issued',expiresAt:now+900000},executionAuthorized:false});await expect(f.store.observeCredential(pending.proof,{status:'unknown'})).rejects.toThrow();
});
it('refuses forged/serialized phase proofs and keeps unknown credential outcomes as liabilities',async()=>{
 const f=fixture();await f.store.delegate(id,1,f.plan.digest,requester);const claimed=await f.store.claim(id,0,'synthetic-jwt');await expect(f.store.beginCredential(structuredClone(claimed.proof))).rejects.toThrow();const pending=await f.store.beginCredential(claimed.proof);await f.store.observeCredential(pending.proof,{status:'unknown'});expect(await f.store.inspect(id,requester)).toMatchObject({credential:{status:'unknown'},executionAuthorized:false});
});
it('rolls parent, replay and delegation back together if the claim event fails',async()=>{
 const f=fixture();await f.store.delegate(id,1,f.plan.digest,requester);f.failEvents();await expect(f.store.claim(id,0,'synthetic-jwt')).rejects.toThrow();expect(f.parent()).toMatchObject({status:'approved',attemptCount:0});expect(f.record()).toMatchObject({status:'delegated',version:0});expect(f.events()).toHaveLength(1);
});
it('refuses malformed lease references and preserves pending liability when observation cannot be qualified',async()=>{
 const f=fixture();await f.store.delegate(id,1,f.plan.digest,requester);const claimed=await f.store.claim(id,0,'synthetic-jwt'),pending=await f.store.beginCredential(claimed.proof);
 await expect(f.store.observeCredential(pending.proof,{status:'issued',leaseRef:'platform_credential_'+'-'.repeat(36),expiresAt:now+900000})).rejects.toThrow();expect(await f.store.inspect(id,requester)).toMatchObject({version:2,credential:{status:'pending'}});
});
it('checks revoked humans before later workload-profile reads or credential-stage entry',async()=>{
 const f=fixture();await f.store.delegate(id,1,f.plan.digest,requester);const claimed=await f.store.claim(id,0,'synthetic-jwt');vi.mocked(f.identity.assertConsumedCurrent).mockClear();f.revoked.add(reviewer.userId);await expect(f.store.beginCredential(claimed.proof)).rejects.toThrow();expect(f.identity.assertConsumedCurrent).not.toHaveBeenCalled();expect(f.record()).toMatchObject({version:1,credential:{status:'not_requested'}});
});

it('issues only from a committed pending proof and returns no raw credential material',async()=>{
 const issuer={assertQualified:vi.fn(async()=>{}),issue:vi.fn(async(_manifest:unknown,beforeIssue:()=>Promise<void>)=>{await beforeIssue();return {leaseRef:'platform_credential_22222222-2222-4222-8222-222222222222',accessKeyId:'SYNTHETIC_ACCESS',secretAccessKey:'SYNTHETIC_SECRET',sessionToken:'SYNTHETIC_TOKEN',expiresAt:now+900000}})},f=fixture(issuer);await f.store.delegate(id,1,f.plan.digest,requester);const claimed=await f.store.claim(id,0,'synthetic'),pending=await f.store.beginCredential(claimed.proof);await expect(f.store.issueCredential({})).rejects.toThrow();const issued=await f.store.issueCredential(pending.proof);expect(issued.history).toMatchObject({credential:{status:'issued'}});expect(issued.credentialHandle).toBeTruthy();expect(JSON.stringify(issued)).not.toMatch(/SYNTHETIC_(ACCESS|SECRET|TOKEN)/);await expect(f.store.issueCredential(pending.proof)).rejects.toThrow();expect(issuer.issue).toHaveBeenCalledTimes(1);
});
it('records unknown issuance without returning a handle or allowing another mint',async()=>{
 const issuer={assertQualified:vi.fn(async()=>{}),issue:vi.fn(async()=>{throw Error('PRIVATE provider response')})},f=fixture(issuer);await f.store.delegate(id,1,f.plan.digest,requester);const claimed=await f.store.claim(id,0,'synthetic'),pending=await f.store.beginCredential(claimed.proof),result=await f.store.issueCredential(pending.proof);expect(result).toMatchObject({credentialHandle:null,history:{credential:{status:'unknown'}}});await expect(f.store.issueCredential(pending.proof)).rejects.toThrow();expect(issuer.issue).toHaveBeenCalledTimes(1);
});
it('preserves issued liability when reviewer access changes during issuance but returns no usable handle',async()=>{
 const issuer={assertQualified:vi.fn(async()=>{}),issue:vi.fn()},f=fixture(issuer);issuer.issue.mockImplementation(async(_manifest:unknown,beforeIssue:()=>Promise<void>)=>{await beforeIssue();f.revoked.add(reviewer.userId);return {leaseRef:'platform_credential_22222222-2222-4222-8222-222222222222',accessKeyId:'SYNTHETIC',secretAccessKey:'SYNTHETIC',sessionToken:'SYNTHETIC',expiresAt:now+900000}});await f.store.delegate(id,1,f.plan.digest,requester);const claimed=await f.store.claim(id,0,'synthetic'),pending=await f.store.beginCredential(claimed.proof);await expect(f.store.issueCredential(pending.proof)).rejects.toThrow('operational_credential_issuance_unconfirmed');expect(await f.store.inspect(id,requester)).toMatchObject({credential:{status:'issued'}});expect(issuer.issue).toHaveBeenCalledOnce();
});
it('bounds a stalled issuer and retains unknown without another issuance',async()=>{
 vi.useFakeTimers();try{const issuer={assertQualified:vi.fn(async()=>{}),issue:vi.fn(async()=>new Promise(()=>{}))},f=fixture(issuer);await f.store.delegate(id,1,f.plan.digest,requester);const claimed=await f.store.claim(id,0,'synthetic'),pending=await f.store.beginCredential(claimed.proof),result=f.store.issueCredential(pending.proof);await vi.advanceTimersByTimeAsync(10001);expect(await result).toMatchObject({credentialHandle:null,history:{credential:{status:'unknown'}}});expect(issuer.issue).toHaveBeenCalledOnce()}finally{vi.useRealTimers()}
});

it('recovers original command acceptance separately from delegation history without using old source authority',async()=>{
 const f=fixture();await f.store.delegate(id,1,f.plan.digest,requester);const claimed=await f.store.claim(id,0,'synthetic'),pending=await f.store.beginCredential(claimed.proof),leaseRef='platform_credential_22222222-2222-4222-8222-222222222222';await f.store.observeCredential(pending.proof,{status:'issued',leaseRef,expiresAt:now+900000});
 const result=createOperationalEcsResult({format:1,purpose:'operational_ecs_update_result_v1',actionId:id,manifestDigest:f.manifest.digest,nativeKey:nativeEcsTargetKey(f.manifest.target),generation:1,leaseRef,kind:'accepted',deploymentId:'ecs-svc/2',requestId:'synthetic-result',observedAt:now,stable:false,rollbackAuthorized:false});
 const repo:OperationalDelegationRepository={transaction:fn=>f.repo.transaction(tx=>fn({...tx,readEffect:async()=> 'confirmed',readOperationalEcsResult:async()=>result}))};
 f.source.assertCurrent.mockClear();f.source.assertCurrent.mockRejectedValue(Error('old source unavailable'));f.revoked.add(reviewer.userId);f.setNow(now+400000);
 const store=createOperationalDelegationStore(repo,{assertCurrent:async(_tx,p)=>{if(f.revoked.has(p.userId))throw Error('revoked')}},f.source,f.identity);
 expect(await store.inspect(id,requester)).toMatchObject({parentStatus:'claimed',effectStatus:'confirmed',result:{kind:'accepted',deploymentId:'ecs-svc/2',stable:false},expired:true,executionAuthorized:false,sourceValidation:'not_checked'});
 expect(f.source.assertCurrent).not.toHaveBeenCalled();
 const {receiptDigest:ignoredDigest,...fields}=result;const corrupt=createOperationalEcsResult({...fields,generation:2});const wrong=createOperationalDelegationStore({transaction:fn=>f.repo.transaction(tx=>fn({...tx,readEffect:async()=> 'confirmed',readOperationalEcsResult:async()=>corrupt}))},{assertCurrent:async()=>{}},f.source,f.identity);
 await expect(wrong.inspect(id,requester)).rejects.toThrow();
});
import {createOperationalEcsResult} from '../ecsExecution';

it('requires one current final issuance callback before returning a credential handle',async()=>{
 let physicalMints=0;const issuer={assertQualified:vi.fn(async()=>{}),issue:vi.fn(async(_manifest:unknown,beforeIssue:()=>Promise<void>)=>{await beforeIssue();physicalMints++;return {leaseRef:'platform_credential_22222222-2222-4222-8222-222222222222',accessKeyId:'SYNTHETIC_ACCESS',secretAccessKey:'SYNTHETIC_SECRET',sessionToken:'SYNTHETIC_TOKEN',expiresAt:now+900000}})},f=fixture(issuer);await f.store.delegate(id,1,f.plan.digest,requester);const claimed=await f.store.claim(id,0,'synthetic'),pending=await f.store.beginCredential(claimed.proof),issued=await f.store.issueCredential(pending.proof);expect(issued.credentialHandle).toBeTruthy();expect(physicalMints).toBe(1);
});
it('refuses revocation during issuer preparation before a simulated physical mint',async()=>{let physicalMints=0;const issuer={assertQualified:vi.fn(async()=>{}),issue:vi.fn()},f=fixture(issuer);issuer.issue.mockImplementation(async(_manifest:unknown,beforeIssue:()=>Promise<void>)=>{f.revoked.add(reviewer.userId);await beforeIssue();physicalMints++;throw Error('must not reach')});await f.store.delegate(id,1,f.plan.digest,requester);const claim=await f.store.claim(id,0,'synthetic'),pending=await f.store.beginCredential(claim.proof);expect(await f.store.issueCredential(pending.proof)).toMatchObject({credentialHandle:null,history:{credential:{status:'unknown'}}});expect(physicalMints).toBe(0)});
it('retains known issued liability but returns no handle if an issuer omits the final gate',async()=>{const issuer={assertQualified:vi.fn(async()=>{}),issue:vi.fn(async()=>({leaseRef:'platform_credential_22222222-2222-4222-8222-222222222222',accessKeyId:'SYNTHETIC_ACCESS',secretAccessKey:'SYNTHETIC_SECRET',sessionToken:'SYNTHETIC_TOKEN',expiresAt:now+900000}))},f=fixture(issuer);await f.store.delegate(id,1,f.plan.digest,requester);const claim=await f.store.claim(id,0,'synthetic'),pending=await f.store.beginCredential(claim.proof);await expect(f.store.issueCredential(pending.proof)).rejects.toThrow();expect(await f.store.inspect(id,requester)).toMatchObject({credential:{status:'issued'},executionAuthorized:false})});

it('does not release operational history when reader access changes during the final clock read',async()=>{
 const f=fixture();await f.store.delegate(id,1,f.plan.digest,requester);
 const repo:OperationalDelegationRepository={transaction:fn=>f.repo.transaction(tx=>fn({...tx,now:async()=>{const time=await tx.now();f.revoked.add(requester.userId);return time}}))};
 const store=createOperationalDelegationStore(repo,{assertCurrent:async(_tx,actor)=>{if(f.revoked.has(actor.userId))throw Error('revoked')}},f.source,f.identity);
 await expect(store.inspect(id,requester)).rejects.toThrow('revoked');
});
it('rechecks original authority after a joined clock check, before the simulated physical mint',async()=>{
 let physicalMints=0,clockReads=0;
 const issuer={assertQualified:vi.fn(async()=>{}),issue:vi.fn()},f=fixture(issuer);
 issuer.issue.mockImplementation(async(_m:unknown,beforeIssue:(timeCheck?:()=>Promise<void>)=>Promise<void>)=>{
  await beforeIssue(async()=>{clockReads++;f.revoked.add(reviewer.userId)});physicalMints++;
  return {leaseRef:'platform_credential_22222222-2222-4222-8222-222222222222',accessKeyId:'SYNTHETIC_ACCESS',secretAccessKey:'SYNTHETIC_SECRET',sessionToken:'SYNTHETIC_TOKEN',expiresAt:now+900000};
 });
 await f.store.delegate(id,1,f.plan.digest,requester);const claim=await f.store.claim(id,0,'synthetic'),pending=await f.store.beginCredential(claim.proof);
 expect(await f.store.issueCredential(pending.proof)).toMatchObject({credentialHandle:null,history:{credential:{status:'unknown'}}});
 expect(clockReads).toBe(1);expect(physicalMints).toBe(0);
});

it('refuses new human delegation without private time while keeping saved metadata inspectable',async()=>{const f=fixture(),store=createOperationalDelegationStoreActual(f.repo,{assertCurrent:async()=>{}},f.source,f.identity);await expect(store.delegate(id,1,f.plan.digest,requester)).rejects.toThrow();expect(f.record()).toBeNull();expect(f.parent()).toMatchObject({status:'approved',attemptCount:0})});
it('intersects both human sessions and manifest/source expiry before recording delegation',async()=>{for(const kind of ['action','reviewer','source']){const f=fixture(),repo:OperationalDelegationRepository={transaction:fn=>f.repo.transaction(tx=>fn({...tx,readPrincipal:async p=>({...p,live:true,sessionIssuedAtMs:now,sessionExpiresAtMs:kind==='reviewer'&&p.userId==='reviewer'?now:now+600000})}))},source={...f.source,readTimeWindow:async(_tx:unknown,m:typeof f.manifest)=>({manifestDigest:m.digest,sourceEvidenceId:m.sourceEvidenceId,profileDigest:d,notBefore:now,expiresAt:kind==='source'?now:now+600000})},store=createOperationalDelegationStoreActual(repo,{assertCurrent:async()=>{}},source,f.identity,undefined,undefined,undefined,undefined,{clock:async()=>({earliest:now,latest:kind==='action'?now+300000:now}),signal:new AbortController().signal});await expect(store.delegate(id,1,f.plan.digest,requester)).rejects.toThrow();expect(f.record()).toBeNull();expect(f.parent()).toMatchObject({status:'approved',attemptCount:0})}});

import {createOperationalDelegationRequestComposition} from '../operationalRequest';
it('joins actual Request possession and captured time through human delegation without adding execution authority',async()=>{
 for(const kind of ['valid','expired','possession','cancel','late-possession'] as const){
  const f=fixture(),controller=new AbortController(),request=new Request('http://fixture.invalid',{headers:{authorization:'Bearer synthetic-requester'},signal:controller.signal});
  const repo:OperationalDelegationRepository={transaction:fn=>f.repo.transaction(tx=>fn({...tx,readSessionPrincipal:async sessionId=>({userId:'requester',sessionId}),readPrincipal:async p=>({...p,live:true,email:p.userId+'@example.test',sessionIssuedAtMs:now,sessionExpiresAtMs:now+600000})}))};
  let windowReads=0;const service=await createOperationalDelegationRequestComposition(request,{repo,source:{...f.source,readTimeWindow:async(_tx,m)=>{if(kind==='late-possession'&&++windowReads===4)request.headers.delete('authorization');return {manifestDigest:m.digest,sourceEvidenceId:m.sourceEvidenceId,profileDigest:d,notBefore:now,expiresAt:now+600000}}},identity:f.identity,verifyDesktopToken:token=>{if(token!=='synthetic-requester')throw Error('invalid');return {sessionId:requester.sessionId}},readAdminEmails:()=>['requester@example.test','reviewer@example.test'],clock:async()=>{if(kind==='possession')request.headers.delete('authorization');if(kind==='cancel')controller.abort();return {earliest:now,latest:kind==='expired'?now+300000:now}}});
  if(kind==='valid'){expect(await service.delegate(id,1,f.plan.digest)).toMatchObject({status:'delegated',executionAuthorized:false,providerExecution:false});expect(f.parent()).toMatchObject({status:'approved',attemptCount:0})}
  else{await expect(service.delegate(id,1,f.plan.digest)).rejects.toThrow();expect(f.record()).toBeNull();expect(f.parent()).toMatchObject({status:'approved',attemptCount:0})}
 }
});
