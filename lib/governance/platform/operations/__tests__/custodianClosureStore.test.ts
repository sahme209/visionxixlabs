import {it,expect,vi} from 'vitest';
import {createCustodianClosureService,type CustodianClosureRepository} from '../custodianClosureStore';
import {compileCustodianClosureSnapshot} from '../custodianClosureSnapshot';
import {compileCustodianDrainPlan,compileCustodianDrainPlatformPlan} from '../custodianDrainContract';
import {createPlatformAction,approvePlatformAction,claimPlatformAction,finishPlatformAction} from '../../kernel';
import {fixture as historyFixture} from './fixtures/custodianClosure';
const requester={userId:'requester',sessionId:'requester-session'},reviewer={userId:'reviewer',sessionId:'reviewer-session'},a='a'.repeat(64),ref='platform_evidence_11111111-1111-4111-8111-111111111111';
function fixture(){
 const f=historyFixture(),snapshot=compileCustodianClosureSnapshot(f.barrier,[f.row]);
 const control=compileCustodianDrainPlan({format:1,scope:'platform',operation:'begin',custodian:{accountId:'123456789012',roleArn:'arn:aws:iam::123456789012:role/private'},issuerProfileDigest:a,sourceEvidenceDigest:a,predecessorAdmissionDigest:a,expectedGeneration:f.opened.generation,expectedVersion:f.opened.version,expiresAt:'2099-01-01T00:00:00Z'});
 const plan=compileCustodianDrainPlatformPlan(control),parent=finishPlatformAction(claimPlatformAction(approvePlatformAction(createPlatformAction(plan,requester,1000),{...reviewer,planDigest:plan.digest},1500),requester,2000),'confirmed',3000);
 expect(control.digest).toBe(snapshot.barrier.controlDigest);
 const evidence={format:1,purpose:'platform_custodian_native_lifetime_evidence_v1',nativeKey:f.barrier.nativeKey,issuerProfileDigest:a,generation:f.barrier.generation,barrierVersion:f.barrier.version,controlDigest:control.digest,snapshotDigest:snapshot.digest,fleetReceiptId:ref,runtimeReceiptId:ref,lifetimeReceiptId:ref,timeReceiptId:ref,lastPossibleIssueAt:4500,credentialNotAfter:10000,trustedNow:{earliest:10001,latest:10002},expiresAt:20000};
 const source={readEvidence:vi.fn(async()=>evidence),assertCurrent:vi.fn(async()=>{}),clock:vi.fn(async()=>({earliest:10001,latest:10002}))},authority={assertCurrent:vi.fn(async()=>{})};
 let events:unknown[]=[],saved:unknown=null,staged=false,loseAck=false,sessionEnd=30000;
 const repo:CustodianClosureRepository={transaction:async fn=>{
  const pending:unknown[]=[];let next=saved;
  const tx={readPrincipal:async(p:typeof requester)=>({...p,live:true,sessionIssuedAtMs:0,sessionExpiresAtMs:sessionEnd}),lock:async()=>{},read:async()=>parent,readCustodianControl:async()=>control,readEffect:async()=> 'confirmed',lockCustodian:async()=>{},readCustodianClosureSnapshot:async()=>snapshot,readCustodianClosure:async()=>saved,now:async()=>5000,event:async(event:{custodianClosure?:unknown})=>{staged=true;pending.push(event);next=event.custodianClosure}};
  // Only the service's exercised transaction methods are supplied; this is an
  // isolated memory double, not SQL or a qualified repository implementation.
  const result=await fn(tx as unknown as Parameters<Parameters<CustodianClosureRepository['transaction']>[0]>[0]);events.push(...pending);saved=next;if(loseAck){loseAck=false;throw Error('synthetic committed acknowledgement lost')}return result;
 }};
 return {source,authority,service:createCustodianClosureService(repo,authority,source),snapshot,id:f.barrier.controlActionId,events:()=>events,staged:()=>staged,setSessionEnd:(value:number)=>{sessionEnd=value},loseAck:()=>{loseAck=true}};
}
it.each([{earliest:9999,latest:10001},{earliest:10000,latest:10001},{earliest:10001,latest:20000}])('refuses a fresh closure when the private interval overlaps liability or receipt expiry %j',async interval=>{
 const f=fixture(),before=JSON.stringify(f.snapshot);f.source.clock.mockResolvedValue(interval);
 await expect(f.service.observe(f.id,requester,false,new AbortController().signal)).rejects.toThrow('platform_custodian_closure_unavailable');expect(f.events()).toHaveLength(0);expect(JSON.stringify(f.snapshot)).toBe(before);
});
it('preserves history-only recovery without requalifying an old observation or clearing unknowns',async()=>{
 const f=fixture(),before=JSON.stringify(f.snapshot),signal=new AbortController().signal;
 expect(await f.service.observe(f.id,requester,false,signal)).toMatchObject({historical:false,executionAuthorized:false});f.source.clock.mockRejectedValue(Error('native time unavailable'));
 expect(await f.service.observe(f.id,requester,false,signal)).toMatchObject({historical:true,sourceValidation:'historical_not_checked',executionAuthorized:false});
 await expect(f.service.observe(f.id,requester,true,signal)).rejects.toThrow();expect(f.events()).toHaveLength(1);expect(JSON.stringify(f.snapshot)).toBe(before);
});
it('checks authority again after the awaited private clock before committing an observation',async()=>{
 const f=fixture();let revoked=false;f.authority.assertCurrent.mockImplementation(async()=>{if(revoked)throw Error('revoked')});f.source.clock.mockImplementation(async()=>{revoked=true;return {earliest:10001,latest:10002}});
 await expect(f.service.observe(f.id,requester,false,new AbortController().signal)).rejects.toThrow();expect(f.events()).toHaveLength(0);
});

it('rolls a tentative observation back when its final private time check reaches receipt expiry',async()=>{
 const f=fixture();f.source.clock.mockImplementation(async()=>f.staged()?{earliest:19999,latest:20000}:{earliest:10001,latest:10002});
 await expect(f.service.observe(f.id,requester,false,new AbortController().signal)).rejects.toThrow();expect(f.events()).toHaveLength(0);
});
it('preserves a committed observation after a lost acknowledgement and recovers it as history only',async()=>{
 const f=fixture(),signal=new AbortController().signal;f.loseAck();await expect(f.service.observe(f.id,requester,false,signal)).rejects.toThrow();expect(f.events()).toHaveLength(1);
 f.source.clock.mockRejectedValue(Error('unavailable'));expect(await f.service.observe(f.id,requester,false,signal)).toMatchObject({historical:true,sourceValidation:'historical_not_checked',executionAuthorized:false});expect(f.events()).toHaveLength(1);
});
it('does not commit after cancellation during its private clock read',async()=>{
 const f=fixture(),controller=new AbortController();f.source.clock.mockImplementation(async()=>{controller.abort();return {earliest:10001,latest:10002}});
 await expect(f.service.observe(f.id,requester,false,controller.signal)).rejects.toThrow();expect(f.events()).toHaveLength(0);
});

it('intersects the final closure interval with the reader session rather than only the receipt lifetime',async()=>{
 const f=fixture();f.setSessionEnd(15000);f.source.clock.mockImplementation(async()=>f.staged()?{earliest:14999,latest:15000}:{earliest:10001,latest:10002});
 await expect(f.service.observe(f.id,requester,false,new AbortController().signal)).rejects.toThrow();expect(f.events()).toHaveLength(0);
});
