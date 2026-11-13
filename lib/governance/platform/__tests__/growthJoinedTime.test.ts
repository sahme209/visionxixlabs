import {afterEach,expect,it,vi} from 'vitest';
import {createPlatformActionService,type PlatformRepository,type PlatformTransaction} from '../actionStore';
import {createCurrentPlatformAuthority} from '../currentAuthority';
import type {PlatformAction} from '../contracts';
const at=Date.parse('2026-11-12T00:00:00Z'),actor={userId:'requester',sessionId:'requester-session'},reviewer={userId:'reviewer',sessionId:'reviewer-session'};
function fixture(){
 vi.stubEnv('LINKEDIN_POSTING_ENABLED','true');
 const source={draft:{id:'draft',title:'Title',hook:'Hook',body:'Body',cta:null,hashtags:[],imageUrn:null,status:'approved',scheduledFor:null as Date|null,updatedAt:new Date(at-1000)},connection:{id:'connection',linkedinUrn:'urn:li:person:author',organizationUrn:null,scopes:'w_member_social',status:'connected',expiresAt:new Date(at+60000),updatedAt:new Date(at-1000)}};
 const sources=new Map([[source.draft.id,source]]);
 let rows=new Map<string,PlatformAction>(),effects=new Map<string,string>(),events:unknown[]=[],queue=Promise.resolve(),loseAck=false,committedAckLoss=false,now=at;let publication:{actionId:string;state:PlatformAction}|undefined;
 const controller=new AbortController(),expiry=new Map([[actor.userId,at+120000],[reviewer.userId,at+120000]]),allowed=new Set([actor.userId,reviewer.userId]),clock=vi.fn(async()=>({earliest:at,latest:at+1})),reserve=vi.fn(async()=>{});
 const repo:PlatformRepository={transaction:async fn=>{
  const previous=queue;let release!:()=>void;queue=new Promise(r=>{release=r});await previous;
  const next=new Map(rows),children=new Map(effects),log=[...events],oldDrafts=new Map([...sources].map(([id,value])=>[id,structuredClone(value.draft)]));let scheduleChanged=false,committed=false;
  const tx:PlatformTransaction={now:async()=>now,lock:async()=>{},read:async id=>next.get(id)??null,readSessionPrincipal:async sessionId=>sessionId===actor.sessionId?actor:sessionId===reviewer.sessionId?reviewer:null,
   readPrincipal:async p=>({...p,email:p.userId+'@example.test',live:allowed.has(p.userId),sessionIssuedAtMs:at-2000,sessionExpiresAtMs:expiry.get(p.userId)}),readGrowthPostingSource:async draftId=>structuredClone(sources.get(draftId)),readGrowthDeletionSource:async()=>{if(!publication)throw Error('missing publication');return {draft:{id:source.draft.id,status:source.draft.status,linkedinPostUrn:'urn:li:share:fixture',updatedAt:source.draft.updatedAt},connection:structuredClone(source.connection),publication:{...publication,outcome:'success',postUrn:'urn:li:share:fixture'}}},
   insert:async(id,s)=>{if(next.has(id))throw Error('duplicate');next.set(id,s)},replace:async(id,v,s)=>{if(next.get(id)?.version!==v)throw Error('version');next.set(id,s)},event:async e=>{log.push(e)},
   readEffect:async(id,i)=>children.get(id+':'+i)??null,writeEffect:async(id,i,expected,s)=>{const k=id+':'+i;if((children.get(k)??null)!==expected)throw Error('effect');children.set(k,s)},reservePublication:reserve,reservePostDeletion:reserve,
  };
  Reflect.set(tx,'applyGrowthSchedule',async(id:string,index:number,effect:PlatformAction['plan']['effects'][number],expectedUpdatedAt:Date)=>{const current=effect.kind==='growth.schedule.change'?sources.get(effect.target.draftId):undefined;if(!current||effect.kind!=='growth.schedule.change'||next.get(id)?.status!=='claimed'||children.get(id+':'+index)!=='claimed'||current.draft.updatedAt.getTime()!==expectedUpdatedAt.getTime())throw Error('schedule');scheduleChanged=true;current.draft.status='scheduled';current.draft.scheduledFor=new Date(effect.target.scheduledFor);current.draft.updatedAt=new Date(now);await afterSchedule()});
  try{const value=await fn(tx);if(loseAck)throw Error('commit_ack_unknown');rows=next;effects=children;events=log;committed=true;if(committedAckLoss){committedAckLoss=false;throw Error('committed_ack_lost')}return value}catch(error){if(scheduleChanged&&!committed)for(const [id,old] of oldDrafts)Object.assign(sources.get(id)!.draft,old);throw error}finally{release()}
 }};
 let afterSchedule=async()=>{};
 const authority=createCurrentPlatformAuthority(()=>['requester@example.test','reviewer@example.test']);
 const timing={clock,signal:controller.signal};
 const service=createPlatformActionService(repo,authority,timing);
 async function prepare(operation:'publish'|'schedule'='publish',scheduledOffset=90000){
  const saved=await service.prepareGrowth({operation,draftId:'draft',connectionId:'connection',expiresAt:new Date(at+30000).toISOString(),...(operation==='schedule'?{scheduledFor:new Date(at+scheduledOffset).toISOString()}:{})},actor);
  return {id:saved.actionId,plan:rows.get(saved.actionId)!.plan};
 }
 async function claimed(operation:'publish'|'schedule'='publish',scheduledOffset=90000){const p=await prepare(operation,scheduledOffset);await service.review(p.id,0,p.plan.digest,reviewer);await service.claim(p.id,1,actor);const child=await service.claimNextEffect(p.id,actor);return {...p,child}}
 return {source,repo,authority,service,timing,addDraft:(id:string)=>{const other=structuredClone(source);other.draft.id=id;sources.set(id,other);return other},rememberPublication:(actionId:string)=>{publication={actionId,state:rows.get(actionId)!};source.draft.status='published';source.draft.updatedAt=new Date(at)},clock,controller,expiry,allowed,reserve,prepare,claimed,rows:()=>rows,effects:()=>effects,events:()=>events,loseAck:()=>{loseAck=true},loseCommittedAckOnce:()=>{committedAckLoss=true},setNow:(value:number)=>{now=value},afterSchedule:(fn:()=>Promise<void>)=>{afterSchedule=fn}};
}
afterEach(()=>vi.unstubAllEnvs());
it('refuses new growth preparation when the requester interval has expired while database time stays live',async()=>{
 const f=fixture();f.expiry.set(actor.userId,at+1);await expect(f.prepare()).rejects.toThrow();expect(f.rows().size).toBe(0);
});
it('checks the prospective independent reviewer before storing their decision',async()=>{
 const f=fixture(),p=await f.prepare();f.expiry.set(reviewer.userId,at+1);await expect(f.service.review(p.id,0,p.plan.digest,reviewer)).rejects.toThrow();expect(f.rows().get(p.id)?.status).toBe('proposed');
});
it('refuses a final publish whose approved action deadline is overlapped by the uncertainty interval',async()=>{
 const f=fixture(),p=await f.claimed();f.clock.mockResolvedValue({earliest:at+59999,latest:at+60000});await expect(f.service.beforeEffectSend(p.child.proof,p.child.effect,actor)).rejects.toThrow();await f.service.observeEffect(p.child.proof,'unknown');expect(f.rows().get(p.id)).toMatchObject({status:'unknown',attemptCount:1});await expect(f.service.beforeEffectSend(p.child.proof,p.child.effect,actor)).rejects.toThrow();
});
it('refuses source revisions that are still in the future according to the private interval',async()=>{
 const f=fixture();f.source.draft.updatedAt=new Date(at+1);await expect(f.prepare()).rejects.toThrow();expect(f.rows().size).toBe(0);
});
it('rechecks people and exact rendered source after the final clock await',async()=>{
 for(const change of ['role','source'] as const){const f=fixture(),p=await f.claimed();f.clock.mockImplementation(async()=>{if(change==='role')f.allowed.delete(reviewer.userId);else f.source.draft.body='substituted';return {earliest:at,latest:at+1}});await expect(f.service.beforeEffectSend(p.child.proof,p.child.effect,actor)).rejects.toThrow();await f.service.observeEffect(p.child.proof,'unknown');expect(f.rows().get(p.id)?.status).toBe('unknown')}
});
it('cancellation refuses a final send and does not restore the consumed child',async()=>{
 const f=fixture(),p=await f.claimed();f.controller.abort();await expect(f.service.beforeEffectSend(p.child.proof,p.child.effect,actor)).rejects.toThrow();await f.service.observeEffect(p.child.proof,'unknown');expect(f.rows().get(p.id)?.attemptCount).toBe(1);
});
it('a live clock allows original prepare-review-claim-send-observe without changing the payload',async()=>{
 const f=fixture(),p=await f.claimed();await f.service.beforeEffectSend(p.child.proof,p.child.effect,actor);await f.service.observeEffect(p.child.proof,'confirmed');expect(f.rows().get(p.id)).toMatchObject({status:'confirmed',attemptCount:1,plan:p.plan});expect(f.reserve).toHaveBeenCalledTimes(1);
});
it('rechecks the interval after a permanent publication reservation waits',async()=>{
 const f=fixture(),p=await f.claimed();f.reserve.mockImplementation(async()=>{f.clock.mockResolvedValue({earliest:at+29999,latest:at+30000})});await expect(f.service.beforeEffectSend(p.child.proof,p.child.effect,actor)).rejects.toThrow();expect(f.reserve).toHaveBeenCalledTimes(1);await f.service.observeEffect(p.child.proof,'unknown');await expect(f.service.claimNextEffect(p.id,actor)).rejects.toThrow();
});
it('missing private timing refuses new growth work but preserves non-capability history',async()=>{
 const f=fixture(),p=await f.prepare(),old=createPlatformActionService(f.repo,f.authority);await expect(old.review(p.id,0,p.plan.digest,reviewer)).rejects.toThrow();expect(await old.inspect(p.id,reviewer)).toMatchObject({status:'proposed',authority:'history_only'});expect(f.rows().get(p.id)?.attemptCount).toBe(0);
});
it('a lost final commit acknowledgment withholds send and does not restore its proof',async()=>{
 const f=fixture(),p=await f.claimed();f.loseAck();await expect(f.service.beforeEffectSend(p.child.proof,p.child.effect,actor)).rejects.toThrow();await expect(f.service.beforeEffectSend(p.child.proof,p.child.effect,actor)).rejects.toThrow();expect(f.effects().get(p.id+':0')).toBe('claimed');expect(f.rows().get(p.id)?.attemptCount).toBe(1);
});
it('the real child coordinator never invokes its synthetic outbound operation after expiry',async()=>{
 const {bindPlatformExecution,runPlatformEffect}=await import('../effectExecution'),f=fixture(),p=await f.prepare();await f.service.review(p.id,0,p.plan.digest,reviewer);await f.service.claim(p.id,1,actor);let sends=0;
 const bound=bindPlatformExecution({claimNextEffect:id=>f.service.claimNextEffect(id,actor),beforeEffectSend:(proof,effect)=>f.service.beforeEffectSend(proof,effect,actor),observeEffect:f.service.observeEffect},p.id);
 await expect(runPlatformEffect(bound,p.plan.effects[0],async beforeSend=>{f.clock.mockResolvedValue({earliest:at+30000,latest:at+30001});await beforeSend();sends++;return {outcome:'confirmed',value:true}})).rejects.toThrow();expect(sends).toBe(0);expect(f.rows().get(p.id)).toMatchObject({status:'unknown',attemptCount:1});
});

it('applies a schedule inside the same original final authorization transaction',async()=>{
 const f=fixture(),p=await f.claimed('schedule');await f.service.beforeEffectSend(p.child.proof,p.child.effect,actor);expect(f.source.draft).toMatchObject({status:'scheduled',scheduledFor:new Date(at+90000)});await f.service.observeEffect(p.child.proof,'confirmed');expect(f.rows().get(p.id)?.status).toBe('confirmed');
});
it('rolls the schedule back if expiry or revocation happens during the conditional update',async()=>{
 for(const cause of ['expiry','role','source','database'] as const){const f=fixture(),p=await f.claimed('schedule'),original=structuredClone(f.source.draft);f.afterSchedule(async()=>{if(cause==='expiry')f.clock.mockResolvedValue({earliest:at+30000,latest:at+30001});else if(cause==='role')f.allowed.delete(reviewer.userId);else if(cause==='source')f.source.draft.body='changed';else f.setNow(at+30000)});await expect(f.service.beforeEffectSend(p.child.proof,p.child.effect,actor)).rejects.toThrow();expect(f.source.draft).toEqual(original);await f.service.observeEffect(p.child.proof,'unknown');expect(f.rows().get(p.id)).toMatchObject({status:'unknown',attemptCount:1});await expect(f.service.claimNextEffect(p.id,actor)).rejects.toThrow()}
});

it('intersects a scheduled-for deadline that is shorter than the approval deadline',async()=>{
 const f=fixture(),p=await f.claimed('schedule',10000);f.clock.mockResolvedValue({earliest:at+9999,latest:at+10000});await expect(f.service.beforeEffectSend(p.child.proof,p.child.effect,actor)).rejects.toThrow();expect(f.source.draft.status).toBe('approved');await f.service.observeEffect(p.child.proof,'unknown');
});
it('the real private request composition captures its clock and rechecks bearer possession across time reads',async()=>{
 const {createPlatformRequestComposition}=await import('../requestComposition'),f=fixture(),headers=new Headers({authorization:'Bearer requester-session'}),ports={repo:f.repo,clock:f.clock,readAdminEmails:()=>['requester@example.test','reviewer@example.test'],verifyDesktopToken:(token:string)=>({sessionId:token})};
 const service=await createPlatformRequestComposition({headers,signal:f.controller.signal},ports);ports.clock=vi.fn(async()=>({earliest:at+120000,latest:at+120001}));
 const selected={operation:'publish',draftId:'draft',connectionId:'connection',expiresAt:new Date(at+30000).toISOString()};const first=await service.prepareGrowth(selected);expect(f.rows().get(first.actionId)?.status).toBe('proposed');expect(ports.clock).not.toHaveBeenCalled();
 f.clock.mockImplementation(async()=>{headers.set('authorization','Bearer reviewer-session');return {earliest:at,latest:at+1}});await expect(service.prepareGrowth(selected)).rejects.toThrow();expect(f.rows().size).toBe(1);
});
it('a separately reviewed deletion uses current people and connection, preserving the original publication',async()=>{
 const f=fixture(),published=await f.claimed();await f.service.beforeEffectSend(published.child.proof,published.child.effect,actor);await f.service.observeEffect(published.child.proof,'confirmed');f.rememberPublication(published.id);
 const selected={operation:'delete',draftId:'draft',connectionId:'connection',expiresAt:new Date(at+30000).toISOString()},saved=await f.service.prepareGrowth(selected,actor),plan=f.rows().get(saved.actionId)!.plan;await f.service.review(saved.actionId,0,plan.digest,reviewer);await f.service.claim(saved.actionId,1,actor);const child=await f.service.claimNextEffect(saved.actionId,actor);f.clock.mockResolvedValue({earliest:at+30000,latest:at+30001});await expect(f.service.beforeEffectSend(child.proof,child.effect,actor)).rejects.toThrow();await f.service.observeEffect(child.proof,'unknown');expect(f.rows().get(saved.actionId)).toMatchObject({status:'unknown',attemptCount:1});expect(f.rows().get(published.id)).toMatchObject({status:'confirmed',attemptCount:1,plan:published.plan});
});

it('continues a multi-effect plan after an earlier independent schedule is genuinely confirmed',async()=>{
 const {preparePlatformLinkedInSchedule}=await import('@/lib/growth/linkedin/platformPostingPlan'),{compilePlatformPlan}=await import('../kernel'),f=fixture(),second=f.addDraft('draft-b'),when=new Date(at+90000),effects=[preparePlatformLinkedInSchedule(f.source.draft,f.source.connection,'202605',at,when,'a').effect,preparePlatformLinkedInSchedule(second.draft,second.connection,'202605',at,when,'b').effect],plan=compilePlatformPlan({format:1,scope:'platform',sourceDigest:'a'.repeat(64),expiresAt:new Date(at+30000).toISOString(),effects}),id=await f.service.propose(plan,actor);
 await f.service.review(id,0,plan.digest,reviewer);await f.service.claim(id,1,actor);
 const first=await f.service.claimNextEffect(id,actor);await f.service.beforeEffectSend(first.proof,first.effect,actor);await f.service.observeEffect(first.proof,'confirmed');
 const next=await f.service.claimNextEffect(id,actor);expect(next.effect.id).toBe('b');await f.service.beforeEffectSend(next.proof,next.effect,actor);await f.service.observeEffect(next.proof,'confirmed');expect(f.rows().get(id)).toMatchObject({status:'confirmed',attemptCount:1});expect(f.source.draft.status).toBe('scheduled');expect(second.draft.status).toBe('scheduled');
});

it('preserves a committed schedule after a lost acknowledgment as unknown, never a replayable refusal',async()=>{
 const f=fixture(),p=await f.claimed('schedule');f.loseCommittedAckOnce();await expect(f.service.beforeEffectSend(p.child.proof,p.child.effect,actor)).rejects.toThrow();expect(f.source.draft.status).toBe('scheduled');await expect(f.service.beforeEffectSend(p.child.proof,p.child.effect,actor)).rejects.toThrow();await f.service.observeEffect(p.child.proof,'unknown');expect(f.rows().get(p.id)).toMatchObject({status:'unknown',attemptCount:1});await expect(f.service.claimNextEffect(p.id,actor)).rejects.toThrow();expect(f.source.draft.scheduledFor).toEqual(new Date(at+90000));
});
