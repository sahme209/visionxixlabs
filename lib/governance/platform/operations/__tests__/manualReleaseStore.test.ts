import {it,expect,vi} from 'vitest';
import {createManualReleaseStore,type ManualReleaseRepository,type ManualReleaseTransaction} from '../manualReleaseStore';
const at=Date.parse('2026-11-12T00:00:00Z'),requester={userId:'requester',sessionId:'requester-session'},reviewer={userId:'reviewer',sessionId:'reviewer-session'},ref='platform_evidence_11111111-1111-4111-8111-111111111111',d='a'.repeat(64),commit='b'.repeat(40),requestId='22222222-2222-4222-8222-222222222222';
const selection={manifestEvidenceId:ref,expiresAt:new Date(at+60000).toISOString()};
function manifest(){return {format:1,scope:'platform',kind:'release.manual',expiresAt:selection.expiresAt,source:{repository:'sahme209/visionxixlabs',branch:'main',commit},target:{projectId:'prj_fixture',teamId:'team_fixture',environment:'production'},sourceHashes:{workflow:d,build:d,configuration:d,lock:d,schema:d},artifactEvidenceId:ref,ciEvidence:[{name:'Typecheck + Vitest',receiptId:ref,commit}],compatibilityEvidenceId:ref,recoveryEvidenceId:ref,smokeProfileId:'production-smoke-v1'}}
function fixture(){
 let rows=new Map<string,unknown>(),events:unknown[]=[],tail=Promise.resolve(),now=at,failEvent=false,loseClaimAck=false;const revoked=new Set<string>();
 const repo:ManualReleaseRepository={transaction:async fn=>{const wait=tail;let release!:()=>void;tail=new Promise(r=>{release=r});await wait;const next=new Map(rows),nextEvents=[...events];
  const tx:ManualReleaseTransaction={readSessionPrincipal:async()=>{throw Error('not used')},readPrincipal:async()=>{throw Error('not used')},lock:async()=>{},now:async()=>now,read:async id=>next.get(id)??null,insert:async(id,value)=>{if(next.has(id))throw Error('duplicate');next.set(id,value)},replace:async(id,expected,value)=>{const old=next.get(id) as {version:number}|undefined;if(old?.version!==expected)throw Error('stale');next.set(id,value)},event:async event=>{if(failEvent)throw Error('event unavailable');nextEvents.push(event)}};
  try{const result=await fn(tx);rows=next;events=nextEvents;if(loseClaimAck&&[...rows.values()].some(row=>(row as {status?:string}).status==='notice_claimed'))throw Error('commit acknowledgement lost');return result}finally{release()}
 }};
 const assertCurrent=vi.fn(async(_tx:ManualReleaseTransaction,p:typeof requester)=>{if(revoked.has(p.userId))throw Error('revoked')});
 const source={buildCurrentManifest:vi.fn(async()=>manifest()),assertCurrent:vi.fn(async()=>{})};const store=createManualReleaseStore(repo,{assertCurrent},source);
 return {store,source,assertCurrent,rows:()=>rows,events:()=>events,revoked,setNow:(v:number)=>{now=v},failEvents:()=>{failEvent=true},loseClaimAcknowledgement:()=>{loseClaimAck=true}};
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
