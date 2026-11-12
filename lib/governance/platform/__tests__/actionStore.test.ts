import {it,expect,vi,afterEach} from 'vitest';
import {createPlatformActionService,type PlatformRepository,type PlatformTransaction} from '../actionStore';
import {compilePlatformPlan} from '../kernel';
import type {PlatformAction} from '../contracts';
const requester={userId:'requester',sessionId:'requester-session'},reviewer={userId:'reviewer',sessionId:'reviewer-session'},d='a'.repeat(64);
const at=Date.parse('2026-11-12T00:00:00Z');
const plan=()=>compilePlatformPlan({format:1,scope:'platform',sourceDigest:d,expiresAt:new Date(at+60000).toISOString(),effects:[{id:'one',kind:'settings.vercel',target:{projectId:'project',settingsDigest:d}},{id:'two',kind:'settings.vercel',target:{projectId:'other',settingsDigest:d}}]});
function fixture(growthSource?:unknown){
 let rows=new Map<string,PlatformAction>(),events:unknown[]=[],effects=new Map<string,unknown>(),publications=new Map<string,string>(),queue=Promise.resolve(),now=at,failEvent=false;
 const repo:PlatformRepository={transaction:async fn=>{
  const before=queue;let release!:()=>void;queue=new Promise(r=>{release=r});await before;
  const next=new Map(rows),nextEvents=[...events],nextEffects=new Map(effects),nextPublications=new Map(publications);
  const tx:PlatformTransaction={readGrowthPostingSource:async()=>growthSource??null,readSessionPrincipal:async()=>null,readPrincipal:async()=>null,now:async()=>now,lock:async()=>{},read:async id=>next.get(id)??null,
   insert:async(id,state)=>{if(next.has(id))throw Error('duplicate');next.set(id,state)},
   replace:async(id,version,state)=>{if(next.get(id)?.version!==version)throw Error('stale');next.set(id,state)},
   event:async event=>{if(failEvent)throw Error('event_unavailable');nextEvents.push(event)},
   reservePublication:async(id,index,draftId)=>{if(nextPublications.has(draftId))throw Error('publication_already_reserved');nextPublications.set(draftId,id+':'+index)},
   readEffect:async(id,index)=>nextEffects.get(id+':'+index)??null,
   writeEffect:async(id,index,expected,state)=>{const key=id+':'+index;if((nextEffects.get(key)??null)!==expected)throw Error('stale_effect');nextEffects.set(key,state)},
  };
  try{const value=await fn(tx);rows=next;events=nextEvents;effects=nextEffects;publications=nextPublications;return value}finally{release()}
 }};
 const assertCurrent=vi.fn(async(_tx:PlatformTransaction,_actor:typeof requester)=>{});
 const service=createPlatformActionService(repo,{assertCurrent,assertEffectCurrent:async()=>{}});
 return {service,assertCurrent,rows:()=>rows,events:()=>events,setNow:(v:number)=>{now=v},failEvents:()=>{failEvent=true}};
}
async function ready(f:ReturnType<typeof fixture>){const id=await f.service.propose(plan(),requester);await f.service.review(id,0,plan().digest,reviewer);return id}
it('records genuine review separately and original requester claims exactly once',async()=>{
 const f=fixture(),id=await ready(f);expect(f.rows().get(id)?.status).toBe('approved');
 await expect(f.service.claim(id,1,reviewer)).rejects.toThrow();
 const results=await Promise.allSettled([f.service.claim(id,1,requester),f.service.claim(id,1,requester)]);
 expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);expect(f.rows().get(id)?.attemptCount).toBe(1);expect(f.events()).toHaveLength(3);
});
it('rolls back claim and event together on audit-transition failure',async()=>{
 const f=fixture(),id=await ready(f);f.failEvents();await expect(f.service.claim(id,1,requester)).rejects.toThrow();expect(f.rows().get(id)?.status).toBe('approved');expect(f.events()).toHaveLength(2);
});
it('rechecks requester/reviewer after awaited claim and refuses revocation/expiry',async()=>{
 for(const mode of ['revoked','expired']){
  const f=fixture(),id=await ready(f);let calls=0;
  f.assertCurrent.mockImplementation(async()=>{if(++calls===4){if(mode==='revoked')throw Error('revoked');f.setNow(at+60000)}});
  await expect(f.service.claim(id,1,requester)).rejects.toThrow();expect(f.rows().get(id)?.status).toBe('approved');
 }
});
it('claims effects in exact order and confirms parent only after all effects',async()=>{
 const f=fixture(),id=await ready(f);await f.service.claim(id,1,requester);
 const one=await f.service.claimNextEffect(id,requester);expect(one.effect.id).toBe('one');expect(f.rows().get(id)?.status).toBe('claimed');
 await expect(f.service.claimNextEffect(id,requester)).rejects.toThrow();
 await f.service.beforeEffectSend(one.proof,one.effect,requester);await f.service.observeEffect(one.proof,'confirmed');expect(f.rows().get(id)?.status).toBe('claimed');
 const two=await f.service.claimNextEffect(id,requester);expect(two.effect.id).toBe('two');await f.service.beforeEffectSend(two.proof,two.effect,requester);await f.service.observeEffect(two.proof,'confirmed');expect(f.rows().get(id)?.status).toBe('confirmed');
});
it('unknown child consumes proof, stops every later effect and preserves history',async()=>{
 const f=fixture(),id=await ready(f);await f.service.claim(id,1,requester);const one=await f.service.claimNextEffect(id,requester);
 await f.service.observeEffect(one.proof,'unknown');expect(f.rows().get(id)?.status).toBe('unknown');expect(f.rows().get(id)?.attemptCount).toBe(1);
 await expect(f.service.observeEffect(one.proof,'confirmed')).rejects.toThrow();await expect(f.service.claimNextEffect(id,requester)).rejects.toThrow();
});
it('does not treat a claimed effect without result as retryable',async()=>{
 const f=fixture(),id=await ready(f);await f.service.claim(id,1,requester);await f.service.claimNextEffect(id,requester);
 await expect(f.service.claimNextEffect(id,requester)).rejects.toThrow();expect(f.rows().get(id)?.status).toBe('claimed');
});
it('checks current human authority for every child and rejects invented observation proofs',async()=>{
 const f=fixture(),id=await ready(f);await f.service.claim(id,1,requester);f.assertCurrent.mockRejectedValue(Error('reviewer_revoked'));
 await expect(f.service.claimNextEffect(id,requester)).rejects.toThrow();await expect(f.service.observeEffect({},'confirmed')).rejects.toThrow();
});
it('requires final current one-use authorization before a confirmed observation',async()=>{
 const f=fixture(),id=await ready(f);await f.service.claim(id,1,requester);const one=await f.service.claimNextEffect(id,requester);
 await expect(f.service.observeEffect(one.proof,'confirmed')).rejects.toThrow();
 // A rejected observation conservatively consumes its private capability.
 await expect(f.service.beforeEffectSend(one.proof,one.effect,requester)).rejects.toThrow();
});
it('binds the final send to exact effect, requester and current reviewer; no second send',async()=>{
 const f=fixture(),id=await ready(f);await f.service.claim(id,1,requester);const one=await f.service.claimNextEffect(id,requester);
 await f.service.beforeEffectSend(one.proof,one.effect,requester);
 await expect(f.service.beforeEffectSend(one.proof,one.effect,requester)).rejects.toThrow();
 await f.service.observeEffect(one.proof,'confirmed');
});
it('refuses changed targets or final revoked authority and never restores send capability',async()=>{
 for(const cause of ['target','reviewer','actor'] as const){
  const f=fixture(),id=await ready(f);await f.service.claim(id,1,requester);const one=await f.service.claimNextEffect(id,requester);
  if(cause==='reviewer')f.assertCurrent.mockRejectedValueOnce(Error('revoked'));
  const original=one.effect;if(original.kind!=='settings.vercel')throw Error('exact_fixture_effect_required');
  const changed={...original,target:{...original.target,projectId:'changed'}};
  await expect(f.service.beforeEffectSend(one.proof,cause==='target'?changed:one.effect,cause==='actor'?reviewer:requester)).rejects.toThrow();
  await expect(f.service.beforeEffectSend(one.proof,one.effect,requester)).rejects.toThrow();
  await f.service.observeEffect(one.proof,'unknown');expect(f.rows().get(id)?.status).toBe('unknown');
 }
});
it('cannot grant a final send after concurrent outcome observation consumes its proof',async()=>{
 for(const outcome of ['unknown','refused'] as const){
  const f=fixture(),id=await ready(f);await f.service.claim(id,1,requester);const one=await f.service.claimNextEffect(id,requester);
  let release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>{release=r}),started=new Promise<void>(r=>{entered=r});let first=true;
  f.assertCurrent.mockImplementation(async()=>{if(first){first=false;entered();await waiting}});
  const sending=f.service.beforeEffectSend(one.proof,one.effect,requester);await started;
  // observeEffect consumes synchronously, then waits for the held transaction.
  const recording=f.service.observeEffect(one.proof,outcome);release();
  const result=await Promise.allSettled([sending,recording]);expect(result[0].status).toBe('rejected');expect(result[1].status).toBe('fulfilled');
  expect(f.rows().get(id)?.status).toBe(outcome);await expect(f.service.beforeEffectSend(one.proof,one.effect,requester)).rejects.toThrow();
 }
});

it('does not grant another action the same native draft after an unknown publication',async()=>{
 const f=fixture(),p=compilePlatformPlan({format:1,scope:'platform',sourceDigest:d,expiresAt:new Date(at+60000).toISOString(),effects:[{id:'post',kind:'growth.post.publish',target:{draftId:'same-draft',connectionId:'connection',connectionRevision:'revision',author:'urn:li:person:test',renderedPayloadDigest:d}}]});
 const ids=[];for(let i=0;i<2;i++){const id=await f.service.propose(p,requester);await f.service.review(id,0,p.digest,reviewer);await f.service.claim(id,1,requester);ids.push(id)}
 const first=await f.service.claimNextEffect(ids[0],requester);await f.service.beforeEffectSend(first.proof,first.effect,requester);await f.service.observeEffect(first.proof,'unknown');
 const next=await f.service.claimNextEffect(ids[1],requester);await expect(f.service.beforeEffectSend(next.proof,next.effect,requester)).rejects.toThrow();
 expect(f.rows().get(ids[0])?.status).toBe('unknown');await expect(f.service.beforeEffectSend(next.proof,next.effect,requester)).rejects.toThrow();
});

afterEach(()=>vi.unstubAllEnvs());
it('the same authenticated preparation reference returns the original record without renewing or reading changed source',async()=>{
 vi.stubEnv('LINKEDIN_POSTING_ENABLED','true');const source={draft:{id:'draft',title:'Title',hook:'Hook',body:'Body',cta:null,hashtags:[],imageUrn:null,status:'approved',scheduledFor:null,updatedAt:new Date(at-1000)},connection:{id:'connection',linkedinUrn:'urn:li:person:author',organizationUrn:null,scopes:'w_member_social',status:'connected',expiresAt:new Date(at+60000),updatedAt:new Date(at-1000)}},f=fixture(source),selection={operation:'publish',draftId:'draft',connectionId:'connection',expiresAt:new Date(at+30000).toISOString()},nonce='11111111-1111-4111-8111-111111111111';
 const original=await f.service.prepareGrowth(selection,requester,nonce);source.draft.body='changed';const repeated=await f.service.prepareGrowth(selection,requester,nonce);expect(repeated.actionId).toBe(original.actionId);expect(repeated).toMatchObject({historical:true});expect(repeated.preview).toBeUndefined();expect(f.rows().size).toBe(1);expect(f.events()).toHaveLength(1);
 await expect(f.service.prepareGrowth({...selection,expiresAt:new Date(at+40000).toISOString()},requester,nonce)).rejects.toThrow();
 expect(await f.service.lookupGrowthPreparation(nonce,requester)).toMatchObject({found:true,actionId:original.actionId,authority:'history_only'});expect(await f.service.lookupGrowthPreparation(nonce,reviewer)).toMatchObject({found:false,authority:'history_only'});
});
