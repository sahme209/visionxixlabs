import {it,expect,vi} from 'vitest';
import {createPlatformRequestComposition} from '../requestComposition';
import type {PlatformTransaction,PlatformRepository} from '../actionStore';
import type {PlatformAction} from '../contracts';
const at=Date.parse('2026-11-12T00:00:00Z'),d='a'.repeat(64);
const raw=()=>({format:1,scope:'platform',sourceDigest:d,expiresAt:new Date(at+60000).toISOString(),effects:[{id:'one',kind:'settings.vercel',target:{projectId:'project',settingsDigest:d}}]});
function fixture(){
 const rows=new Map<string,PlatformAction>(),events:unknown[]=[],identities=new Map([['requester-session','requester'],['reviewer-session','reviewer']]);
 const readSessionPrincipal=vi.fn(async(sessionId:string)=>({sessionId,userId:identities.get(sessionId)}));
 const readPrincipal=vi.fn(async(p:{userId:string;sessionId:string})=>({...p,email:p.userId+'@example.test',live:identities.get(p.sessionId)===p.userId}));
 const tx:PlatformTransaction={readGrowthPostingSource:async()=>null,readSessionPrincipal,readPrincipal,now:async()=>at,lock:async()=>{},read:async id=>rows.get(id)??null,insert:async(id,state)=>{rows.set(id,state)},replace:async(id,_version,state)=>{rows.set(id,state)},event:async e=>{events.push(e)},readEffect:async()=>null,writeEffect:async()=>{}};
 const repo:PlatformRepository={transaction:fn=>fn(tx)};
 const verify=vi.fn((token:string)=>{if(!token.startsWith('synthetic-valid-'))throw Error('bad_signature');return {sessionId:token.slice('synthetic-valid-'.length)}});
 const headers=new Headers({authorization:'Bearer synthetic-valid-requester-session'});
 const ports={repo,verifyDesktopToken:verify,readAdminEmails:()=>['requester@example.test','reviewer@example.test']};
 return {rows,events,identities,readSessionPrincipal,readPrincipal,verify,headers,ports};
}
it('requires an actual verified bearer before any database lookup',async()=>{
 for(const header of [null,'Bearer arbitrary-session','Bearer vxl_api_key','Basic synthetic-valid-requester-session']){
  const f=fixture();if(header)f.headers.set('authorization',header);else f.headers.delete('authorization');
  await expect(createPlatformRequestComposition({headers:f.headers},f.ports)).rejects.toThrow();expect(f.readSessionPrincipal).not.toHaveBeenCalled();expect(f.rows.size).toBe(0);
 }
});
it('derives stable requester from the verified session and never accepts a supplied actor',async()=>{
 const f=fixture(),request=await createPlatformRequestComposition({headers:f.headers},f.ports);const id=await request.propose(raw());
 expect(f.rows.get(id)?.requester).toEqual({userId:'requester',sessionId:'requester-session'});
 await expect(request.propose({...raw(),requester:{userId:'reviewer',sessionId:'reviewer-session'}})).rejects.toThrow();
});
it('requires a second possessed genuine identity for independent review',async()=>{
 const f=fixture(),request=await createPlatformRequestComposition({headers:f.headers},f.ports),id=await request.propose(raw()),digest=f.rows.get(id)!.plan.digest;
 await expect(request.review(id,0,digest)).rejects.toThrow();
 const reviewer=await createPlatformRequestComposition({headers:new Headers({authorization:'Bearer synthetic-valid-reviewer-session'})},f.ports);
 await reviewer.review(id,0,digest);expect(f.rows.get(id)?.reviewer?.userId).toBe('reviewer');
 await expect(reviewer.claim(id,1)).rejects.toThrow();await request.claim(id,1);expect(f.rows.get(id)?.attemptCount).toBe(1);
});
it('refuses replacement or invalidation of the possessed token after binding',async()=>{
 for(const replacement of ['Bearer arbitrary-session','Bearer synthetic-valid-reviewer-session']){
  const f=fixture(),request=await createPlatformRequestComposition({headers:f.headers},f.ports);f.headers.set('authorization',replacement);
  await expect(request.propose(raw())).rejects.toThrow();expect(f.rows.size).toBe(0);
 }
});
it('rechecks possession after an awaited current-authority read',async()=>{
 const f=fixture(),request=await createPlatformRequestComposition({headers:f.headers},f.ports);
 f.readPrincipal.mockImplementation(async p=>{f.headers.delete('authorization');return {...p,email:p.userId+'@example.test',live:true}});
 await expect(request.propose(raw())).rejects.toThrow();expect(f.rows.size).toBe(0);
});

it('current admin can inspect exact historical state without session identifiers or new execution authority',async()=>{
 const f=fixture(),request=await createPlatformRequestComposition({headers:f.headers},f.ports),id=await request.propose(raw());
 const before=f.events.length,reviewer=await createPlatformRequestComposition({headers:new Headers({authorization:'Bearer synthetic-valid-reviewer-session'})},f.ports);
 const result=await reviewer.inspect(id);expect(result).toMatchObject({actionId:id,status:'proposed',requesterUserId:'requester',reviewerUserId:null,authority:'history_only',sourceValidation:'not_checked',effects:[{id:'one',status:'not_started'}]});
 expect(JSON.stringify(result)).not.toContain('requester-session');expect(f.events).toHaveLength(before);expect(f.rows.get(id)?.status).toBe('proposed');
 f.identities.delete('reviewer-session');await expect(reviewer.inspect(id)).rejects.toThrow();
});
