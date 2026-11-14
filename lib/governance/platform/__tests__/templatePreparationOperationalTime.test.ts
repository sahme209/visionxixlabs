import {it,expect,vi,beforeEach} from 'vitest';
const bytes=vi.hoisted(()=>({read:vi.fn()}));
vi.mock('@/lib/cloud/aws/platformTemplateSource',()=>({readPlatformTemplateBytes:bytes.read}));
import {createTemplatePreparationStore} from '../templatePreparationStore';
import type {PlatformRepository,PlatformTransaction} from '../actionStore';
const actor={userId:'requester',sessionId:'requester-session'},reviewer={userId:'reviewer',sessionId:'reviewer-session'},digest='a'.repeat(64);
beforeEach(()=>bytes.read.mockResolvedValue(Buffer.from('Resources: {}\n')));
function fixture(){
 let now=1000,reviewerEnd=60000;let saved:unknown=null,binding:unknown=null;const events:unknown[]=[];
 const tx={lock:async()=>{},now:async()=>1000,read:async()=>saved,insert:async(_id:string,v:unknown)=>{saved=v},replace:async(_id:string,_version:number,v:unknown)=>{saved=v},event:async(e:{templateBinding?:unknown})=>{if(e.templateBinding)binding=e.templateBinding;events.push(e)},readTemplateBinding:async()=>binding,readPrincipal:async(p:typeof actor)=>({...p,live:true,sessionIssuedAtMs:0,sessionExpiresAtMs:p.userId===reviewer.userId?reviewerEnd:60000})} as unknown as PlatformTransaction;
 const repo:PlatformRepository={transaction:async fn=>{const prior=saved,priorBinding=binding,n=events.length;try{return await fn(tx)}catch(e){saved=prior;binding=priorBinding;events.length=n;throw e}}};
 const profile={accountId:'123456789012',region:'us-east-2',profileDigest:digest,access:null};
 const profiles={read:vi.fn(async()=>profile),assertQualified:vi.fn(async()=>{}),readTimeWindow:async()=>({notBefore:0,expiresAt:60000})},authority={assertCurrent:vi.fn(async()=>{})},signal=new AbortController().signal;
 const service=createTemplatePreparationStore(repo,authority,profiles,{clock:async()=>({earliest:now,latest:now}),signal});
 const selection={operation:'upload',accountId:profile.accountId,region:profile.region,expiresAt:new Date(50000).toISOString()},reference='11111111-1111-4111-8111-111111111111';
 return {service,repo,authority,profiles,selection,reference,events,set:(v:number)=>{now=v},expireReviewer:()=>{reviewerEnd=1000}};
}
it('refuses new preparation without captured timing before insert',async()=>{const f=fixture();await expect(createTemplatePreparationStore(f.repo,f.authority,f.profiles).prepare(f.selection,f.reference,actor)).rejects.toThrow();expect(f.events).toHaveLength(0)});
it('joins live preview and prospective review in original owner without renewing reference history',async()=>{const f=fixture(),r=await f.service.prepare(f.selection,f.reference,actor),before=await f.service.preview(r.actionId,reviewer);f.set(50000);await expect(f.service.preview(r.actionId,reviewer)).rejects.toThrow();await expect(f.service.review(r.actionId,before.state.version,before.state.plan.digest,reviewer)).rejects.toThrow();expect(await f.service.prepare(f.selection,f.reference,actor)).toMatchObject({historical:true})});
it('refuses prospective reviewer expiry before private template bytes',async()=>{const f=fixture(),r=await f.service.prepare(f.selection,f.reference,actor);bytes.read.mockClear();f.expireReviewer();await expect(f.service.preview(r.actionId,reviewer)).rejects.toThrow();expect(bytes.read).not.toHaveBeenCalled()});
it('withholds preview when the real source read crosses the original deadline',async()=>{const f=fixture(),r=await f.service.prepare(f.selection,f.reference,actor);bytes.read.mockImplementation(async()=>{f.set(50000);return Buffer.from('Resources: {}\n')});await expect(f.service.preview(r.actionId,reviewer)).rejects.toThrow()});

it.each(['time','role'] as const)('refuses %s changing in the last private profile await before returning a preview',async mode=>{const f=fixture(),r=await f.service.prepare(f.selection,f.reference,actor);f.profiles.read.mockClear();await f.service.preview(r.actionId,reviewer);const finalRead=f.profiles.read.mock.calls.length;f.profiles.read.mockClear();let reads=0;f.profiles.read.mockImplementation(async()=>{if(++reads===finalRead){if(mode==='time')f.set(50000);else f.authority.assertCurrent.mockRejectedValue(Error('revoked'))}return {accountId:'123456789012',region:'us-east-2',profileDigest:digest,access:null}});await expect(f.service.preview(r.actionId,reviewer)).rejects.toThrow()});
