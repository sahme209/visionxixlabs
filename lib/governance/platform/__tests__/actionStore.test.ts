import {it,expect,vi} from 'vitest';
import {createPlatformActionService,type PlatformRepository,type PlatformTransaction} from '../actionStore';
import {compilePlatformPlan} from '../kernel';
import type {PlatformAction} from '../contracts';
const requester={userId:'requester',sessionId:'requester-session'},reviewer={userId:'reviewer',sessionId:'reviewer-session'},d='a'.repeat(64);
const at=Date.parse('2026-11-12T00:00:00Z');
const plan=()=>compilePlatformPlan({format:1,scope:'platform',sourceDigest:d,expiresAt:new Date(at+60000).toISOString(),effects:[{id:'one',kind:'settings.vercel',target:{projectId:'project',settingsDigest:d}},{id:'two',kind:'settings.vercel',target:{projectId:'other',settingsDigest:d}}]});
function fixture(){
 let rows=new Map<string,PlatformAction>(),events:unknown[]=[],effects=new Map<string,unknown>(),queue=Promise.resolve(),now=at,failEvent=false;
 const repo:PlatformRepository={transaction:async fn=>{
  const before=queue;let release!:()=>void;queue=new Promise(r=>{release=r});await before;
  const next=new Map(rows),nextEvents=[...events],nextEffects=new Map(effects);
  const tx:PlatformTransaction={readPrincipal:async()=>null,now:async()=>now,lock:async()=>{},read:async id=>next.get(id)??null,
   insert:async(id,state)=>{if(next.has(id))throw Error('duplicate');next.set(id,state)},
   replace:async(id,version,state)=>{if(next.get(id)?.version!==version)throw Error('stale');next.set(id,state)},
   event:async event=>{if(failEvent)throw Error('event_unavailable');nextEvents.push(event)},
   readEffect:async(id,index)=>nextEffects.get(id+':'+index)??null,
   writeEffect:async(id,index,expected,state)=>{const key=id+':'+index;if((nextEffects.get(key)??null)!==expected)throw Error('stale_effect');nextEffects.set(key,state)},
  };
  try{const value=await fn(tx);rows=next;events=nextEvents;effects=nextEffects;return value}finally{release()}
 }};
 const assertCurrent=vi.fn(async(_tx:PlatformTransaction,_actor:typeof requester)=>{});
 const service=createPlatformActionService(repo,{assertCurrent});
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
 await f.service.observeEffect(one.proof,'confirmed');expect(f.rows().get(id)?.status).toBe('claimed');
 const two=await f.service.claimNextEffect(id,requester);expect(two.effect.id).toBe('two');await f.service.observeEffect(two.proof,'confirmed');expect(f.rows().get(id)?.status).toBe('confirmed');
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
