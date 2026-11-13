import {createManualReleaseResultInspector} from '../manualReleaseResult';
import {it,expect,vi} from 'vitest';
import {createManualReleaseStore,type ManualReleaseRepository,type ManualReleaseTransaction} from '../manualReleaseStore';
const at=Date.parse('2026-11-12T00:00:00Z'),requester={userId:'requester',sessionId:'requester-session'},reviewer={userId:'reviewer',sessionId:'reviewer-session'},ref='platform_evidence_11111111-1111-4111-8111-111111111111',d='a'.repeat(64),commit='b'.repeat(40),requestId='22222222-2222-4222-8222-222222222222';
const selection={manifestEvidenceId:ref,expiresAt:new Date(at+60000).toISOString()};
function manifest(){return {format:1,scope:'platform',kind:'release.manual',expiresAt:selection.expiresAt,source:{repository:'sahme209/visionxixlabs',branch:'main',commit},target:{projectId:'prj_fixture',teamId:'team_fixture',environment:'production'},sourceHashes:{workflow:d,build:d,configuration:d,lock:d,schema:d},artifactEvidenceId:ref,ciEvidence:[{name:'Typecheck + Vitest',receiptId:ref,commit}],compatibilityEvidenceId:ref,recoveryEvidenceId:ref,smokeProfileId:'production-smoke-v1'}}
function fixture(){
 let rows=new Map<string,unknown>(),events:unknown[]=[],tail=Promise.resolve(),now=at,failEvent=false,loseClaimAck=false,loseReadAck=false;const revoked=new Set<string>(),expires=new Map<string,number>();const controller=new AbortController(),clock=vi.fn(async()=>({earliest:at,latest:at+1}));
 const repo:ManualReleaseRepository={transaction:async fn=>{const wait=tail;let release!:()=>void;tail=new Promise(r=>{release=r});await wait;const next=new Map(rows),nextEvents=[...events];
  const tx:ManualReleaseTransaction={readSessionPrincipal:async()=>{throw Error('not used')},readPrincipal:async p=>({...p,live:true,sessionIssuedAtMs:at-1000,sessionExpiresAtMs:expires.get(p.userId)??at+120000}),lock:async()=>{},now:async()=>now,read:async id=>next.get(id)??null,insert:async(id,value)=>{if(next.has(id))throw Error('duplicate');next.set(id,value)},replace:async(id,expected,value)=>{const old=next.get(id) as {version:number}|undefined;if(old?.version!==expected)throw Error('stale');next.set(id,value)},event:async event=>{if(failEvent)throw Error('event unavailable');nextEvents.push(event)}};
  try{const result=await fn(tx);rows=next;events=nextEvents;if(loseClaimAck&&[...rows.values()].some(row=>(row as {status?:string}).status==='notice_claimed'))throw Error('commit acknowledgement lost');if(loseReadAck)throw Error('read commit acknowledgement lost');return result}finally{release()}
 }};
 const assertCurrent=vi.fn(async(_tx:ManualReleaseTransaction,p:typeof requester)=>{if(revoked.has(p.userId))throw Error('revoked')});
 const source={readTimeWindow:vi.fn(async()=>({notBefore:at,expiresAt:at+60000})),buildCurrentManifest:vi.fn(async()=>manifest()),assertCurrent:vi.fn(async()=>{})};const store=createManualReleaseStore(repo,{assertCurrent},source,{clock,signal:controller.signal});
 return {store,source,repo,assertCurrent,clock,controller,expires,now:()=>now,setReadAckFailure:(value:boolean)=>{loseReadAck=value},rows:()=>rows,events:()=>events,revoked,setNow:(v:number)=>{now=v},failEvents:()=>{failEvent=true},loseClaimAcknowledgement:()=>{loseClaimAck=true}};
}
async function reviewed(f:ReturnType<typeof fixture>){const saved=await f.store.prepare(selection,requester,requestId),view=await f.store.inspect(saved.recordId,reviewer);await f.store.review(saved.recordId,0,view.manifest.digest,reviewer);return saved.recordId}
it('keeps one original proposal reference and returns history without source refresh or expiry renewal',async()=>{
 const f=fixture(),results=await Promise.all([f.store.prepare(selection,requester,requestId),f.store.prepare(selection,requester,requestId)]);expect(results[0].recordId).toBe(results[1].recordId);expect(f.rows().size).toBe(1);expect(f.events()).toHaveLength(1);expect(f.source.buildCurrentManifest).toHaveBeenCalledTimes(1);
 f.setNow(at+60000);f.source.buildCurrentManifest.mockRejectedValue(Error('changed'));expect(await f.store.prepare(selection,requester,requestId)).toMatchObject({recordId:results[0].recordId,historical:true});expect(await f.store.lookup(requestId,requester)).toMatchObject({found:true,recordId:results[0].recordId});await expect(f.store.prepare({...selection,expiresAt:new Date(at+120000).toISOString()},requester,requestId)).rejects.toThrow();expect(await f.store.lookup(requestId,reviewer)).toMatchObject({found:false});
});
it('records genuine separate review and original-session notice exactly once without provider/owner authority',async()=>{
 const f=fixture(),id=await reviewed(f);await expect(f.store.recordNotice(id,1,reviewer)).rejects.toThrow();const results=await Promise.allSettled([f.store.recordNotice(id,1,requester),f.store.recordNotice(id,1,requester)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 const view=await f.store.inspect(id,requester);expect(view).toMatchObject({status:'notice_recorded',attemptCount:1,version:3,ownerAuthorization:'external_not_verified',providerExecution:false,authority:'history_only',sourceValidation:'not_checked'});expect(view).not.toHaveProperty('requester');expect(JSON.stringify(view)).not.toContain(requester.sessionId);expect(f.events()).toHaveLength(4);
});
it('rejects self-review and preserves proposal/event on a failed review transition',async()=>{
 const f=fixture(),saved=await f.store.prepare(selection,requester,requestId),view=await f.store.inspect(saved.recordId,requester);await expect(f.store.review(saved.recordId,0,view.manifest.digest,requester)).rejects.toThrow();f.failEvents();await expect(f.store.review(saved.recordId,0,view.manifest.digest,reviewer)).rejects.toThrow();expect(await f.store.inspect(saved.recordId,requester)).toMatchObject({status:'proposed',version:0,attemptCount:0});expect(f.events()).toHaveLength(1);
});
it('retains the consumed notice claim when source qualification fails after claim and never retries it',async()=>{
 const f=fixture(),id=await reviewed(f);f.source.assertCurrent.mockImplementation(async()=>{if((f.rows().get(id) as {status?:string}|undefined)?.status==='notice_claimed')throw Error('source revoked')});await expect(f.store.recordNotice(id,1,requester)).rejects.toThrow();expect(await f.store.inspect(id,requester)).toMatchObject({status:'notice_claimed',version:2,attemptCount:1});await expect(f.store.recordNotice(id,1,requester)).rejects.toThrow();
});
it('refuses revoked reviewer/expired approval but allows a current reader to inspect historical records',async()=>{
 const f=fixture(),id=await reviewed(f);f.revoked.add(reviewer.userId);await expect(f.store.recordNotice(id,1,requester)).rejects.toThrow();expect(await f.store.inspect(id,requester)).toMatchObject({status:'reviewed',attemptCount:0});f.revoked.clear();f.setNow(at+60000);await expect(f.store.recordNotice(id,1,requester)).rejects.toThrow();expect(await f.store.inspect(id,requester)).toMatchObject({expired:true});f.revoked.add(requester.userId);await expect(f.store.inspect(id,requester)).rejects.toThrow();
});

it('never advances or reclaims a notice after its committed claim acknowledgement is lost',async()=>{
 const f=fixture(),id=await reviewed(f);f.loseClaimAcknowledgement();await expect(f.store.recordNotice(id,1,requester)).rejects.toThrow('manual_release_notice_unconfirmed');
 expect((f.rows().get(id) as {status:string;attemptCount:number})).toMatchObject({status:'notice_claimed',attemptCount:1});expect(f.events()).toHaveLength(3);
 await expect(f.store.recordNotice(id,1,requester)).rejects.toThrow('manual_release_notice_unconfirmed');expect(f.events()).toHaveLength(3);
});

it('uses the prospective reviewer lifetime before recording a review despite database-live=true',async()=>{
 const f=fixture(),p=await f.store.prepare(selection,requester,requestId),v=await f.store.inspect(p.recordId,requester);f.expires.set(reviewer.userId,at+1000);f.clock.mockResolvedValue({earliest:at,latest:at+1000});
 await expect(f.store.review(p.recordId,0,v.manifest.digest,reviewer)).rejects.toThrow();expect(await f.store.inspect(p.recordId,requester)).toMatchObject({status:'proposed',version:0});expect(f.events()).toHaveLength(1);
});
it('refuses an expired approval interval before notice claim although database time remains earlier',async()=>{
 const f=fixture(),id=await reviewed(f);f.clock.mockResolvedValue({earliest:at,latest:at+60000});await expect(f.store.recordNotice(id,1,requester)).rejects.toThrow();expect(await f.store.inspect(id,requester)).toMatchObject({status:'reviewed',attemptCount:0});
});
it('retains the original claimed notice when its deadline expires after the first commit, without restarting it',async()=>{
 const f=fixture(),id=await reviewed(f);f.clock.mockImplementation(async()=>({earliest:at,latest:(f.rows().get(id) as {status:string}).status==='notice_claimed'?at+60000:at+1}));await expect(f.store.recordNotice(id,1,requester)).rejects.toThrow();expect(await f.store.inspect(id,requester)).toMatchObject({status:'notice_claimed',attemptCount:1});await expect(f.store.recordNotice(id,1,requester)).rejects.toThrow();
});
it('rechecks people after the clock await and rolls back the notice claim on revocation',async()=>{
 const f=fixture(),id=await reviewed(f);f.clock.mockImplementation(async()=>{f.revoked.add(reviewer.userId);return {earliest:at,latest:at+1}});await expect(f.store.recordNotice(id,1,requester)).rejects.toThrow();expect(await f.store.inspect(id,requester)).toMatchObject({status:'reviewed',attemptCount:0});
});
it('aborted local authority cannot prepare a new notice record',async()=>{
 const f=fixture();f.controller.abort();await expect(f.store.prepare(selection,requester,requestId)).rejects.toThrow();expect(f.rows().size).toBe(0);
});

function resultFor(f:ReturnType<typeof fixture>,id:string,reader:typeof requester){
 const native={readExact:vi.fn(async(manifest:ReturnType<typeof import('../kernel').compileOperationalManifest>,deploymentId:string)=>{if(manifest.kind!=='release.manual')throw Error('fixture');return {deploymentId,receiptId:ref,...manifest.target,commit:manifest.source.commit,providerState:'READY',observedAt:new Date(f.now()).toISOString(),expiresAt:new Date(f.now()+60000).toISOString()}}),assertQualified:async()=>{},assertReadyEvidence:async()=>{}};
 return {native,inspector:createManualReleaseResultInspector(recordId=>f.store.inspect(recordId,reader),native,{clock:f.clock,signal:f.controller.signal,authorize:(view,check,signal)=>f.store.authorizeObservation(view,reader,check,signal)})};
}
it('joins actual locked reader authorization to a fresh simulated result after old approval expiry and former-reviewer revocation',async()=>{
 const f=fixture(),id=await reviewed(f);await f.store.recordNotice(id,1,requester);const observer={userId:'observer',sessionId:'observer-session'};f.expires.set(observer.userId,at+300000);f.revoked.add(reviewer.userId);f.setNow(at+120000);f.clock.mockResolvedValue({earliest:at+120000,latest:at+120001});const r=resultFor(f,id,observer);
 expect(await r.inspector.inspect(id,'dpl_fixture')).toMatchObject({state:'verified_ready',reviewExpired:true,providerExecution:false,executionAuthorized:false,ownerAuthorization:'external_not_verified'});expect(f.events()).toHaveLength(4);expect(f.rows().get(id)).toMatchObject({status:'notice_recorded',attemptCount:1});expect(r.native.readExact).toHaveBeenCalledTimes(1);
});
it.each(['role','commit'])('withholds the fresh result after %s loss at its final real-store clock check without rereading the provider',async mode=>{
 const f=fixture(),id=await reviewed(f);await f.store.recordNotice(id,1,requester);const r=resultFor(f,id,requester);f.clock.mockImplementation(async()=>{if(r.native.readExact.mock.calls.length){if(mode==='role')f.revoked.add(requester.userId);else f.setReadAckFailure(true)}return {earliest:at,latest:at+1}});
 await expect(r.inspector.inspect(id,'dpl_fixture')).rejects.toThrow();expect(r.native.readExact).toHaveBeenCalledTimes(1);expect(f.rows().get(id)).toMatchObject({status:'notice_recorded',attemptCount:1});expect(f.events()).toHaveLength(4);
});

it('includes source-evidence not-before bounds rather than trusting an ahead database clock',async()=>{
 const f=fixture();f.source.readTimeWindow.mockResolvedValue({notBefore:at+1,expiresAt:at+60000});await expect(f.store.prepare(selection,requester,requestId)).rejects.toThrow();expect(f.rows().size).toBe(0);
});
it('refuses an interval overlapping a shorter source-evidence deadline before notice claim',async()=>{
 const f=fixture(),id=await reviewed(f);f.source.readTimeWindow.mockResolvedValue({notBefore:at,expiresAt:at+1000});f.clock.mockResolvedValue({earliest:at,latest:at+1000});await expect(f.store.recordNotice(id,1,requester)).rejects.toThrow();expect(await f.store.inspect(id,requester)).toMatchObject({status:'reviewed',attemptCount:0});
});
