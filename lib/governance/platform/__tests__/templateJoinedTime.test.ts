const credentialExpiry=Date.now()+86400000; // Synthetic fixture metadata only.
import {it,expect,vi,afterEach} from 'vitest';
import {NodeHttpHandler} from '@smithy/node-http-handler';
import {Readable} from 'node:stream';
import {S3Client} from '@aws-sdk/client-s3';
import {prepareTemplateExecutionPlan} from '../templateExecutionPreparation';
import {createPlatformAction,approvePlatformAction} from '../kernel';
import {createTemplateExecutionStore} from '../templateExecutionStore';
import {reserveTemplateResource,observeTemplateResult,type readTemplateReservation} from '../templateLiability';
import type {TemplateExecutionReceipt} from '../templateExecutionContract';
import type {PlatformRepository,PlatformTransaction,EffectStatus} from '../actionStore';
const now=Date.parse('2026-11-13T00:00:00Z'),id='platform_action_11111111-1111-4111-8111-111111111111',actor={userId:'requester',sessionId:'requester-session'},reviewer={userId:'reviewer',sessionId:'reviewer-session'};
afterEach(()=>vi.restoreAllMocks());
async function fixture(){
 const selection={operation:'create_bucket',accountId:'123456789012',region:'us-east-2',expiresAt:new Date(now+60000).toISOString()},profile={accountId:selection.accountId,region:selection.region,profileDigest:'a'.repeat(64),access:null};
 const prepared=await prepareTemplateExecutionPlan(selection,now,id,actor,profile);let state=approvePlatformAction(createPlatformAction(prepared.plan,actor,now),{...reviewer,planDigest:prepared.plan.digest},now);
 let claims=0,live=true,effect:EffectStatus|null=null,resource:ReturnType<typeof readTemplateReservation>|null=null,receipts:Readonly<TemplateExecutionReceipt>[]=[];
 const repo:PlatformRepository={transaction:async fn=>{
  let staged=state,stagedEffect=effect,stagedResource=resource;const stagedReceipts=[...receipts];
  const tx={lock:async()=>{},now:async()=>now,read:async()=>staged,readTemplateBinding:async()=>prepared.binding,
   readPrincipal:async(p:typeof actor)=>({...p,email:p.userId+'@example.test',live,sessionIssuedAtMs:now-1000,sessionExpiresAtMs:p.userId==='reviewer'?now+1000:now+120000}),
   replace:async(_id:string,version:number,next:typeof state)=>{if(staged.version!==version)throw Error('stale');if(next.status==='claimed')claims++;staged=next},event:async()=>{},readEffect:async()=>stagedEffect,writeEffect:async(_id:string,_index:number,expected:unknown,next:EffectStatus)=>{if(stagedEffect!==expected)throw Error('stale effect');stagedEffect=next},
   templateStorage:{reserve:async()=>{stagedResource=reserveTemplateResource(prepared.binding,now,stagedResource);return stagedResource},readResource:async()=>stagedResource,record:async(value:TemplateExecutionReceipt)=>{stagedResource=observeTemplateResult(stagedResource,prepared.binding,value,now);stagedReceipts.push(value)},receipts:async()=>stagedReceipts,deliveries:async()=>[]},
  } as unknown as PlatformTransaction;
  const result=await fn(tx);state=staged;effect=stagedEffect;resource=stagedResource;receipts=stagedReceipts;return result;
 }},authority={assertCurrent:async()=>{if(!live)throw Error('revoked')}},credential=vi.fn(()=>({accessKeyId:'synthetic',secretAccessKey:'synthetic',expiresAt:credentialExpiry}));
 const resources={profiles:{read:async()=>profile,assertQualified:async()=>{}},assertQualified:async()=>{},readCredential:credential,now:()=>now,clock:async()=>({earliest:now,latest:now+1})};
 let writes=0;
 vi.spyOn(NodeHttpHandler.prototype,'handle').mockImplementation(async request=>{
  if(request.hostname.startsWith('sts.'))return {response:{statusCode:200,headers:{'content-type':'text/xml'},body:Readable.from(['<GetCallerIdentityResponse><GetCallerIdentityResult><Account>123456789012</Account></GetCallerIdentityResult></GetCallerIdentityResponse>'])}};
  writes++;return {response:{statusCode:200,headers:{'content-type':'application/xml'},body:Readable.from([])}};
 });
 return {state:()=>state,repo,authority,resources,credential,claims:()=>claims,writes:()=>writes,revoke:()=>{live=false}};
}
it('joins both locked participant lifetimes before any template claim, despite live database and point clocks',async()=>{
 const f=await fixture();f.resources.clock=async()=>({earliest:now+999,latest:now+1000});
 await expect(createTemplateExecutionStore(f.repo,f.authority,f.resources,new AbortController().signal).execute(id,1,actor)).rejects.toThrow();
 expect(f.claims()).toBe(0);expect(f.credential).not.toHaveBeenCalled();expect(f.writes()).toBe(0);
});
it('rechecks original authority after the joined read and before template claim',async()=>{
 const f=await fixture();f.resources.clock=async()=>{f.revoke();return {earliest:now,latest:now+1}};
 await expect(createTemplateExecutionStore(f.repo,f.authority,f.resources,new AbortController().signal).execute(id,1,actor)).rejects.toThrow();expect(f.claims()).toBe(0);expect(f.writes()).toBe(0);
});
it('requires the original controlling signal for execution',async()=>{
 const f=await fixture();await expect(createTemplateExecutionStore(f.repo,f.authority,f.resources).execute(id,1,actor)).rejects.toThrow();expect(f.claims()).toBe(0);
});
it('joins the actual store, pure reservation/outcome kernels and installed SDK for one accepted simulated command',async()=>{
 const f=await fixture(),store=createTemplateExecutionStore(f.repo,f.authority,f.resources,new AbortController().signal),result=await store.execute(id,1,actor);
 expect(result.receipt).toMatchObject({outcome:'confirmed',detail:{kind:'bucket'}});expect(f.state()).toMatchObject({status:'confirmed',attemptCount:1});expect(f.claims()).toBe(1);expect(f.writes()).toBe(1);
 await expect(store.execute(id,1,actor)).rejects.toThrow();expect((await store.history(id,actor)).receipts).toHaveLength(1);expect(f.writes()).toBe(1);
});
it('the final SDK gate intersects the locked reviewer expiry and preserves one unknown without a write or replay',async()=>{
 const f=await fixture(),send=S3Client.prototype.send;let prepared=false;
 vi.spyOn(S3Client.prototype,'send').mockImplementation(function(this:S3Client,...args:unknown[]){this.middlewareStack.add(next=>async request=>{await Promise.resolve();prepared=true;return next(request)},{step:'finalizeRequest',name:'syntheticLatePreparation',priority:'low'});return Reflect.apply(send,this,args)});
 f.resources.clock=async()=>({earliest:now,latest:prepared?now+1000:now+1});
 const store=createTemplateExecutionStore(f.repo,f.authority,f.resources,new AbortController().signal);
 await expect(store.execute(id,1,actor)).rejects.toThrow('platform_template_native_unconfirmed');expect(f.writes()).toBe(0);expect(f.state()).toMatchObject({status:'unknown',attemptCount:1});expect(f.claims()).toBe(1);
 const history=await store.history(id,actor);expect(history.receipts).toHaveLength(1);expect(history.receipts[0].outcome).toBe('unknown');await expect(store.execute(id,1,actor)).rejects.toThrow();expect(f.writes()).toBe(0);
});
it('withholds the actual SDK write if qualification is revoked during the final joined clock await',async()=>{
 const f=await fixture(),send=S3Client.prototype.send;let prepared=false,qualified=true;
 vi.spyOn(S3Client.prototype,'send').mockImplementation(function(this:S3Client,...args:unknown[]){this.middlewareStack.add(next=>async request=>{prepared=true;return next(request)},{step:'finalizeRequest',name:'syntheticQualificationRevocation',priority:'low'});return Reflect.apply(send,this,args)});
 f.resources.assertQualified=async()=>{if(!qualified)throw Error('profile revoked')};f.resources.clock=async()=>{if(prepared)qualified=false;return {earliest:now,latest:now+1}};
 const store=createTemplateExecutionStore(f.repo,f.authority,f.resources,new AbortController().signal);
 await expect(store.execute(id,1,actor)).rejects.toThrow();expect(f.writes()).toBe(0);expect((await store.history(id,actor)).receipts[0].outcome).toBe('unknown');
});
it('preserves one unknown without an outgoing write when a shorter credential expires during final SDK preparation',async()=>{
 const f=await fixture(),send=S3Client.prototype.send;let prepared=false;
 f.credential.mockReturnValue({accessKeyId:'synthetic',secretAccessKey:'synthetic',expiresAt:now+500});
 vi.spyOn(S3Client.prototype,'send').mockImplementation(function(this:S3Client,...args:unknown[]){this.middlewareStack.add(next=>async request=>{prepared=true;return next(request)},{step:'finalizeRequest',name:'syntheticCredentialExpiry',priority:'low'});return Reflect.apply(send,this,args)});
 f.resources.clock=async()=>({earliest:now,latest:prepared?now+500:now+1});const store=createTemplateExecutionStore(f.repo,f.authority,f.resources,new AbortController().signal);
 await expect(store.execute(id,1,actor)).rejects.toThrow('platform_template_native_unconfirmed');expect(f.writes()).toBe(0);expect(f.state()).toMatchObject({status:'unknown',attemptCount:1});expect((await store.history(id,actor)).receipts[0].outcome).toBe('unknown');await expect(store.execute(id,1,actor)).rejects.toThrow();expect(f.writes()).toBe(0);
});
