import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({row:vi.fn(),decrypt:vi.fn(),update:vi.fn()}));
vi.mock('@/lib/db',()=>({prisma:{linkedInAccountConnection:{findUnique:m.row,updateMany:m.update}}}));
vi.mock('@/lib/security/credentialVault',()=>({decryptCredential:m.decrypt}));
import {createGrowthNativeTransport} from '../growthNativeTransport';
import {preparePlatformLinkedInPost} from '@/lib/growth/linkedin/platformPostingPlan';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import type {ExecutionTimeAuthorization} from '../executionTime';
import {createPlatformActionService,type PlatformTransaction,type PlatformRepository} from '../actionStore';
import {createCurrentPlatformAuthority} from '../currentAuthority';
import {bindPlatformGrowthExecution,runPlatformEffect} from '../effectExecution';
import type {PlatformAction} from '../contracts';
const at=Date.parse('2026-11-13T00:00:00Z'),id='platform_action_11111111-1111-4111-8111-111111111111';
function fixture(){
 const draft={id:'draft',title:'Title',hook:'Hook',body:'Body',cta:null,hashtags:[],imageUrn:null,status:'approved',scheduledFor:null,updatedAt:new Date(at-1000)},connection={id:'connection',linkedinUrn:'urn:li:person:abc',organizationUrn:null,scopes:'w_member_social',status:'connected',expiresAt:new Date(at+60000),updatedAt:new Date(at-1000)},request={kind:'publish' as const,draft,connection,version:'202605'},effect=preparePlatformLinkedInPost(draft,connection,'202605',at).effect;
 const abort=new AbortController(),clock=vi.fn(async()=>({earliest:at,latest:at+1})),profile={profileDigest:'a'.repeat(64),actionId:id,effectDigest:sha256ContentHash(effect),credentialVersion:connection.updatedAt.toISOString(),notBefore:at-1000,expiresAt:at+30000},current=vi.fn(async()=>{}),readProfile=vi.fn(async()=>({...profile})),active=vi.fn(()=>{}),http=vi.fn(async(_url:string,_init:RequestInit)=>new Response(null,{status:201,headers:{'x-restli-id':'urn:li:share:123'}})),owner:ExecutionTimeAuthorization=async(check,finalFacts)=>{if(!check)throw Error('missing check');await check({notBefore:at-1000,expiresAt:at+20000});await finalFacts?.()};
 const dispatch=vi.fn(async()=>{}),ports={assertDispatchCurrent:dispatch,actionId:id,clock,signal:abort.signal,assertActive:active,readProfile,assertProfileCurrent:current,fetch:http},transport=createGrowthNativeTransport(ports);
 m.row.mockResolvedValue({accessToken:'synthetic-ciphertext',updatedAt:connection.updatedAt});m.decrypt.mockReturnValue('synthetic-token');
 return {ports,dispatch,effect,request,abort,clock,profile,current,readProfile,active,http,owner,transport,send:(send:ExecutionTimeAuthorization=owner,acquire:ExecutionTimeAuthorization=owner,recheck:ExecutionTimeAuthorization=owner)=>transport.send(effect,request,send,acquire,recheck)};
}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('LINKEDIN_POSTING_ENABLED','true');vi.stubEnv('LINKEDIN_REST_VERSION','202605')});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs()});
it('uses admitted exact immutable content and selected held credential for one native post',async()=>{const f=fixture();expect(await f.send()).toEqual({kind:'published',urn:'urn:li:share:123',status:201});expect(m.row).toHaveBeenCalledOnce();expect(m.decrypt).toHaveBeenCalledWith('synthetic-ciphertext');expect(f.http).toHaveBeenCalledExactlyOnceWith('https://api.linkedin.com/rest/posts',expect.objectContaining({method:'POST',redirect:'error',headers:expect.objectContaining({Authorization:'Bearer synthetic-token'}),body:expect.stringContaining('Body')}))});
it.each(['cancellation','revocation'] as const)('denies %s during credential row wait BEFORE decrypt or HTTP',async mode=>{const f=fixture();m.row.mockImplementationOnce(async()=>{if(mode==='cancellation')f.abort.abort();else f.current.mockRejectedValue(Error('revoked'));return {accessToken:'synthetic-ciphertext',updatedAt:f.request.connection.updatedAt}});await expect(f.send()).rejects.toThrow();expect(m.decrypt).not.toHaveBeenCalled();expect(f.http).not.toHaveBeenCalled()});
it('denies a changed credential version before decryption',async()=>{const f=fixture();m.row.mockResolvedValueOnce({accessToken:'synthetic-ciphertext',updatedAt:new Date(at)});await expect(f.send()).rejects.toThrow();expect(m.decrypt).not.toHaveBeenCalled();expect(f.http).not.toHaveBeenCalled()});
it('retains one admission while separately rechecking currentness before and after decrypt',async()=>{const f=fixture(),acquire=vi.fn(f.owner),recheck=vi.fn(f.owner);await f.send(f.owner,acquire,recheck);expect(acquire).toHaveBeenCalledOnce();expect(recheck).toHaveBeenCalledTimes(2);expect(f.http).toHaveBeenCalledOnce()});
it('a shorter native profile deadline refuses even when human/action bounds remain valid',async()=>{const f=fixture();f.clock.mockResolvedValue({earliest:at,latest:at+30000});await expect(f.send()).rejects.toThrow();expect(m.row).not.toHaveBeenCalled();expect(m.decrypt).not.toHaveBeenCalled();expect(f.http).not.toHaveBeenCalled()});
it.each(['omitted','twice'] as const)('refuses %s acquisition callback use before credential access',async mode=>{const f=fixture();await expect(f.send(f.owner,async check=>{if(mode==='twice'&&check){await check();await check()}})).rejects.toThrow();expect(m.row).not.toHaveBeenCalled();expect(f.http).not.toHaveBeenCalled()});
it('retires a late final callback and never sends after it returns',async()=>{const f=fixture();let late:Parameters<ExecutionTimeAuthorization>[0];await expect(f.send(async check=>{late=check})).rejects.toThrow();await expect(late!()).rejects.toThrow();expect(f.http).not.toHaveBeenCalled()});
it('does not let a nonawaiting owner skip pending profile requalification',async()=>{const f=fixture();let release!:()=>void,entered!:()=>void;const wait=new Promise<void>(r=>{release=r}),started=new Promise<void>(r=>{entered=r});f.current.mockImplementationOnce(async()=>{}).mockImplementationOnce(async()=>{entered();await wait});await expect(f.send(f.owner,async check=>{void check!().catch(()=>{});await started})).rejects.toThrow();expect(m.row).not.toHaveBeenCalled();release();await Promise.resolve();expect(f.http).not.toHaveBeenCalled()});
it.each(['omitted','repeated'] as const)('requires one completed final facts check (%s)',async mode=>{const f=fixture();await expect(f.send(f.owner,async(check,finalFacts)=>{await check!();if(mode==='repeated'){await finalFacts!();await finalFacts!()}})).rejects.toThrow();expect(m.row).not.toHaveBeenCalled();expect(f.http).not.toHaveBeenCalled()});
it('a pending unawaited final facts check cannot become a credential grant',async()=>{const f=fixture();let block=false,release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>{release=r}),started=new Promise<void>(r=>{entered=r});f.current.mockImplementation(async()=>{if(block){entered();await waiting}});await expect(f.send(f.owner,async(check,finalFacts)=>{await check!();block=true;void finalFacts!().catch(()=>{});await started})).rejects.toThrow();expect(m.row).not.toHaveBeenCalled();release();await Promise.resolve();expect(m.decrypt).not.toHaveBeenCalled();expect(f.http).not.toHaveBeenCalled()});
it('cannot mutate the captured target or content through the profile supplier',async()=>{const f=fixture();f.readProfile.mockImplementationOnce(async()=>{f.request.draft.body='unapproved';Reflect.set(f.effect.target,'connectionId','wrong');return {...f.profile}});expect(await f.send()).toMatchObject({kind:'published'});expect(m.row).toHaveBeenCalledWith({where:{id:'connection'},select:{accessToken:true,updatedAt:true}});expect(f.http.mock.calls[0][1].body).not.toContain('unapproved')});
it('cancels bounded response decoding with the original request and never retries',async()=>{const f=fixture();f.http.mockImplementationOnce(async()=>{f.abort.abort();return new Response('{"id":"urn:li:share:123"}',{status:201})});await expect(f.send()).rejects.toThrow();expect(f.http).toHaveBeenCalledOnce()});
it('keeps an already known remote post identity when the caller disconnects after the response',async()=>{const f=fixture();f.http.mockImplementationOnce(async()=>{f.abort.abort();return new Response(null,{status:201,headers:{'x-restli-id':'urn:li:share:known'}})});expect(await f.send()).toEqual({kind:'published',urn:'urn:li:share:known',status:201});expect(f.http).toHaveBeenCalledOnce()});
it('bounds a stuck credential read and its late continuation cannot decrypt',async()=>{vi.useFakeTimers();const f=fixture();let resolve!:(v:{accessToken:string;updatedAt:Date})=>void;m.row.mockImplementationOnce(()=>new Promise(r=>{resolve=r}));const pending=expect(f.send()).rejects.toThrow();await vi.advanceTimersByTimeAsync(15000);await pending;resolve({accessToken:'late',updatedAt:f.request.connection.updatedAt});await Promise.resolve();expect(m.decrypt).not.toHaveBeenCalled();expect(f.http).not.toHaveBeenCalled()});
it.each(['acquire','pre-decrypt','post-decrypt','send'] as const)('revocation in the last owner await at %s blocks the next private/native effect',async phase=>{
 const f=fixture();let currentChecks=0;
 const owner=async(check?:Parameters<ExecutionTimeAuthorization>[0],finalFacts?:()=>Promise<void>)=>{if(!check)throw Error('missing');await check();f.current.mockRejectedValue(Error('revoked during final owner await'));await finalFacts?.()};
 const recheck:ExecutionTimeAuthorization=async(check,finalFacts)=>{currentChecks++;if((phase==='pre-decrypt'&&currentChecks===1)||(phase==='post-decrypt'&&currentChecks===2))await owner(check,finalFacts);else await f.owner(check,finalFacts)};
 await expect(f.send(phase==='send'?owner:f.owner,phase==='acquire'?owner:f.owner,recheck)).rejects.toThrow();
 if(phase==='acquire')expect(m.row).not.toHaveBeenCalled();if(phase==='acquire'||phase==='pre-decrypt')expect(m.decrypt).not.toHaveBeenCalled();expect(f.http).not.toHaveBeenCalled();
});
it('joins the actual action owner and native transport: final human-row wait revokes profile before credential access',async()=>{
 const f=fixture(),requester={userId:'requester',sessionId:'requester-session'},reviewer={userId:'reviewer',sessionId:'reviewer-session'};
 let rows=new Map<string,PlatformAction>(),effects=new Map<string,unknown>(),armed=false,revoked=false;
 const repo:PlatformRepository={async transaction(fn){const next=new Map(rows),children=new Map(effects);const tx:PlatformTransaction={
  lock:async()=>{},now:async()=>at,readGrowthPostingSource:async()=>({draft:f.request.draft,connection:f.request.connection}),readSessionPrincipal:async()=>null,
  readPrincipal:async person=>{if(armed)revoked=true;return {...person,email:person.userId+'@example.test',live:true,sessionIssuedAtMs:at-1000,sessionExpiresAtMs:at+60000}},
  read:async key=>next.get(key)??null,insert:async(key,state)=>{next.set(key,state)},replace:async(key,_version,state)=>{next.set(key,state)},event:async()=>{},
  readEffect:async(key,index)=>children.get(key+':'+index)??null,writeEffect:async(key,index,_expected,status)=>{children.set(key+':'+index,status)},reservePublication:async()=>{},
 };const value=await fn(tx);rows=next;effects=children;return value}};
 const service=createPlatformActionService(repo,createCurrentPlatformAuthority(()=>['requester@example.test','reviewer@example.test']),{clock:f.clock,signal:f.abort.signal});
 const saved=await service.prepareGrowth({operation:'publish',draftId:'draft',connectionId:'connection',expiresAt:new Date(at+20000).toISOString()},requester);
 const actionId=saved.actionId;await service.review(actionId,0,rows.get(actionId)!.plan.digest,reviewer);await service.claim(actionId,1,requester);
 const effect=rows.get(actionId)!.plan.effects[0];if(effect.kind!=='growth.post.publish')throw Error('fixture');
 const timing={clock:f.clock,signal:f.abort.signal,assertActive:()=>f.abort.signal.throwIfAborted()},native=createGrowthNativeTransport({...timing,actionId,
  assertDispatchCurrent:async()=>{if(revoked)throw Error('dispatch revoked')},readProfile:async()=>({...f.profile,actionId,effectDigest:sha256ContentHash(effect)}),assertProfileCurrent:async()=>{if(revoked)throw Error('profile revoked in owner await')},fetch:f.http,
 });
 const binding=bindPlatformGrowthExecution({claimNextEffect:key=>service.claimNextEffect(key,requester),
  beforeEffectCredential:(proof,selected,check,finalFacts)=>service.beforeEffectCredential(proof,selected,requester,async restriction=>{await check!(restriction);armed=true},finalFacts),
  assertEffectCredentialCurrent:(proof,selected,check,finalFacts)=>service.assertEffectCredentialCurrent(proof,selected,requester,check,finalFacts),
  beforeEffectSend:(proof,selected,check,finalFacts)=>service.beforeEffectSend(proof,selected,requester,check,finalFacts),observeEffect:service.observeEffect,
 },actionId,native,timing);
 await expect(runPlatformEffect(binding,effect,async(send,acquire,current)=>({outcome:'confirmed',value:await native.send(effect,f.request,send,acquire,current)}))).rejects.toThrow();
 expect(revoked).toBe(true);expect(m.row).not.toHaveBeenCalled();expect(m.decrypt).not.toHaveBeenCalled();expect(f.http).not.toHaveBeenCalled();expect(rows.get(actionId)?.status).toBe('unknown');expect(rows.get(actionId)?.attemptCount).toBe(1);
 await expect(runPlatformEffect(binding,effect,async()=>({outcome:'confirmed',value:null}))).rejects.toThrow();expect(m.row).not.toHaveBeenCalled();
});

it.each(['credential-read','credential-decrypt','publish'] as const)('postcommit expiry at %s prevents the next resource effect under the same attempt',async phase=>{
 const f=fixture();let rechecks=0;const expired:ExecutionTimeAuthorization=async(check,last)=>{await f.owner(check,last);f.clock.mockResolvedValue({earliest:at,latest:at+20000})};
 const current:ExecutionTimeAuthorization=async(check,last)=>{if(++rechecks===1&&phase==='credential-decrypt')await expired(check,last);else await f.owner(check,last)};
 await expect(f.send(phase==='publish'?expired:f.owner,phase==='credential-read'?expired:f.owner,current)).rejects.toThrow();
 if(phase==='credential-read')expect(m.row).not.toHaveBeenCalled();if(phase!=='publish')expect(m.decrypt).not.toHaveBeenCalled();expect(f.http).not.toHaveBeenCalled();
});
it('missing explicit native dispatch facts refuses before selected credential access',async()=>{const f=fixture();Reflect.deleteProperty(f.ports,'assertDispatchCurrent');await expect(createGrowthNativeTransport(f.ports).send(f.effect,f.request,f.owner,f.owner,f.owner)).rejects.toThrow();expect(m.row).not.toHaveBeenCalled();expect(f.http).not.toHaveBeenCalled()});

it.each(['credential-read','credential-decrypt','publish'] as const)('native-only dispatch revocation at %s prevents access without repeating authorization',async phase=>{
 const f=fixture();f.dispatch.mockImplementation(async(...args:unknown[])=>{if(args[2]===phase)throw Error('original dispatch binding revoked')});await expect(f.send()).rejects.toThrow();if(phase==='credential-read')expect(m.row).not.toHaveBeenCalled();if(phase!=='publish')expect(m.decrypt).not.toHaveBeenCalled();expect(f.http).not.toHaveBeenCalled();
});
it('postcommit cancellation at publish cannot send or repeat the final owner',async()=>{const f=fixture(),owner=vi.fn(async(check:Parameters<ExecutionTimeAuthorization>[0],last?:()=>Promise<void>)=>{await f.owner(check,last);f.abort.abort()});await expect(f.send(owner)).rejects.toThrow();expect(owner).toHaveBeenCalledOnce();expect(f.http).not.toHaveBeenCalled()});
