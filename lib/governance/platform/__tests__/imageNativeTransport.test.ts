import {afterEach, describe, expect, it, vi} from 'vitest';
import {createHash} from 'node:crypto';
import {prepareImageUploadBinding} from '../imageCustodyContract';
import {imageUploadGrantContext} from '../imageCustodyCodec';
import {createImageNativeTransport, type ImageNativePorts} from '../imageNativeTransport';
const image='urn:li:image:Example_123',address='https://www.linkedin.com/dms-uploads/Example_123/uploaded-image/0?ca=vector_ads&cn=uploads&sync=0&v=beta&ut=synthetic_token';
function fixture(){
 const bytes=Buffer.from('synthetic transport bytes'),now=Date.now(),owner='urn:li:organization:123';
 const binding=prepareImageUploadBinding({artifact:{artifactId:'platform_image_artifact_11111111-1111-4111-8111-111111111111',creatorUserId:'requester',connectionId:'connection',connectionRevision:'a'.repeat(64),author:owner,bytesDigest:createHash('sha256').update(bytes).digest('hex'),byteCount:bytes.length,mimeType:'image/png',width:1,height:1,formatProfileDigest:'b'.repeat(64)},requester:{userId:'requester',sessionId:'session'},actionId:'platform_action_22222222-2222-4222-8222-222222222222',expiresAt:new Date(now+60_000).toISOString(),profile:{profileId:'synthetic-profile',profileDigest:'c'.repeat(64),destinationOrigin:'https://www.linkedin.com'}},now);
 const order:string[]=[],p:ImageNativePorts={version:'202607',now:()=>Date.now(),assertQualified:vi.fn(async()=>{}),assertCurrent:vi.fn(async()=>{}),assertObservationAllowed:vi.fn(async()=>{}),admit:vi.fn(async(_b,i)=>{order.push('commit-'+i)}),readCredential:vi.fn(async()=>{order.push('credential');return 'SYNTHETIC_NOT_REAL'}),assertCredentialCurrent:vi.fn(async()=>{})};
 const context=imageUploadGrantContext(binding,{providerImageReference:image,issuedAt:now,expiresAt:now+30_000});
 return {bytes,now,owner,binding,context,p,order};
}
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers()});
describe('private image native transport with intercepted HTTP only',()=>{
 it('has no qualified default or replayable JSON observation',async()=>{
  const f=fixture(),fetch=vi.spyOn(globalThis,'fetch');await expect(createImageNativeTransport().initialize(f.binding)).rejects.toThrow('platform_image_native_unavailable');expect(fetch).not.toHaveBeenCalled();
  expect(()=>createImageNativeTransport(f.p).consume({},f.binding,0)).toThrow('platform_image_native_unavailable');
 });
 it('commits each exact admission before credentials and returns one-use private init and ready-image proofs',async()=>{
  const f=fixture(),sent:{url:string;init:RequestInit}[]=[],fetch=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
   const url=String(input);sent.push({url,init:init!});
   if(init?.method==='POST')return Response.json({value:{image,uploadUrl:address,uploadUrlExpiresAt:f.now+30_000}});
   if(init?.method==='PUT') {expect(Buffer.from(init.body as Uint8Array)).toEqual(f.bytes);return new Response(null,{status:201})}
   return Response.json({id:image,owner:f.owner,status:'AVAILABLE',downloadUrl:'https://ignored.invalid/private'});
  });
  const t=createImageNativeTransport(f.p),proof=await t.initialize(f.binding);expect(proof).toEqual({});const initialized=t.consume(proof,f.binding,0);expect(initialized).toMatchObject({kind:'initialized',image,address});expect(()=>t.consume(proof,f.binding,0)).toThrow();
  const uploaded=await t.put(f.binding,f.context,address,f.bytes),ready=t.consume(uploaded,f.binding,1);expect(ready).toMatchObject({kind:'ready',image,mediaReady:true});expect(JSON.stringify(ready)).not.toMatch(/token|address|https:|downloadUrl/);
  expect(f.order).toEqual(['commit-0','credential','commit-1','credential']);expect(fetch).toHaveBeenCalledTimes(3);expect(sent.map(v=>v.init.method)).toEqual(['POST','PUT','GET']);
  expect(sent[2].url).toBe('https://api.linkedin.com/rest/images/'+encodeURIComponent(image));
  for(const {init} of sent){expect(init.redirect).toBe('error');expect(init.cache).toBe('no-store');expect(init.credentials).toBe('omit');expect(new Headers(init.headers).get('authorization')).toBe('Bearer SYNTHETIC_NOT_REAL')}
  await expect(t.initialize(f.binding)).rejects.toThrow();await expect(t.put(f.binding,f.context,address,f.bytes)).rejects.toThrow();expect(fetch).toHaveBeenCalledTimes(3);
 });
 it('lost admission acknowledgement and absent observation permission forbid credential access',async()=>{
  const f=fixture(),fetch=vi.spyOn(globalThis,'fetch');vi.mocked(f.p.admit).mockRejectedValue(Error('synthetic_lost_commit'));await expect(createImageNativeTransport(f.p).initialize(f.binding)).rejects.toThrow();expect(f.p.readCredential).not.toHaveBeenCalled();
  vi.mocked(f.p.assertObservationAllowed).mockRejectedValue(Error('synthetic_write_only'));await expect(createImageNativeTransport(f.p).initialize(f.binding)).rejects.toThrow();expect(f.p.admit).toHaveBeenCalledTimes(1);expect(fetch).not.toHaveBeenCalled();
 });
 it('a nonready read after accepted bytes cannot issue proof, poll or repeat the PUT',async()=>{
  const f=fixture(),fetch=vi.spyOn(globalThis,'fetch').mockImplementation(async(_u,i)=>i?.method==='PUT'?new Response(null,{status:201}):Response.json({id:image,owner:f.owner,status:'PROCESSING'})),t=createImageNativeTransport(f.p);
  await expect(t.put(f.binding,f.context,address,f.bytes)).rejects.toThrow('platform_image_native_unavailable');await expect(t.put(f.binding,f.context,address,f.bytes)).rejects.toThrow();expect(fetch.mock.calls.map(c=>c[1]?.method)).toEqual(['PUT','GET']);
 });
 it('refuses changed credentials or revoked current source before dispatch',async()=>{
  const f=fixture(),fetch=vi.spyOn(globalThis,'fetch');vi.mocked(f.p.assertCredentialCurrent).mockRejectedValue(Error('synthetic_changed_credential'));await expect(createImageNativeTransport(f.p).initialize(f.binding)).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();
 });
 it('rejects URL/context/byte substitution before admission and leaks only a fixed error',async()=>{
  const f=fixture(),fetch=vi.spyOn(globalThis,'fetch');for(const [url,bytes] of [[address.replace('www.linkedin.com','evil.invalid'),f.bytes],[address,Buffer.from('different')]] as const)await expect(createImageNativeTransport(f.p).put(f.binding,f.context,url,bytes)).rejects.toThrow('platform_image_native_unavailable');expect(f.p.admit).not.toHaveBeenCalled();expect(f.p.readCredential).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
 });
 it('deadline consumes late credential completion without a send or automatic retry',async()=>{
  vi.useFakeTimers();const f=fixture(),fetch=vi.spyOn(globalThis,'fetch');let release!:(v:string)=>void;vi.mocked(f.p.readCredential).mockImplementation(()=>new Promise(r=>{release=r}));const t=createImageNativeTransport(f.p),pending=t.initialize(f.binding);const rejected=expect(pending).rejects.toThrow('platform_image_native_unavailable');await vi.advanceTimersByTimeAsync(15_001);await rejected;release('SYNTHETIC_LATE');await vi.advanceTimersByTimeAsync(1);expect(fetch).not.toHaveBeenCalled();await expect(t.initialize(f.binding)).rejects.toThrow();
 });
 it('bounds response bytes, rejects redirects and stops on caller cancellation without proof',async()=>{
  for(const mode of ['oversize','redirect','abort'] as const){const f=fixture(),abort=new AbortController();vi.spyOn(globalThis,'fetch').mockImplementation(async()=>{if(mode==='abort'){abort.abort();return Response.json({})}const r=mode==='oversize'?new Response('x'.repeat(65537),{status:200}):Response.json({});if(mode==='redirect')Object.defineProperty(r,'redirected',{value:true});return r});await expect(createImageNativeTransport(f.p,abort.signal).initialize(f.binding)).rejects.toThrow('platform_image_native_unavailable');vi.restoreAllMocks()}
 });
 it('lost PUT response never starts readiness observation and preserves the original bytes',async()=>{
  const f=fixture(),original=Buffer.from(f.bytes);let copied:Uint8Array|undefined;
  const fetch=vi.spyOn(globalThis,'fetch').mockImplementation(async(_u,init)=>{copied=init?.body as Uint8Array;throw Error('synthetic_lost_response_with_private_url')});
  const t=createImageNativeTransport(f.p);await expect(t.put(f.binding,f.context,address,f.bytes)).rejects.toThrow('platform_image_native_unavailable');
  expect(fetch).toHaveBeenCalledTimes(1);expect(f.bytes).toEqual(original);expect(copied?.every(v=>v===0)).toBe(true);
  await expect(t.put(f.binding,f.context,address,f.bytes)).rejects.toThrow();expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('cancels a hung response stream at the whole-attempt deadline and issues no observation',async()=>{
  vi.useFakeTimers();const f=fixture(),cancel=vi.fn();
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(new ReadableStream({cancel}),{status:200}));
  const t=createImageNativeTransport(f.p),pending=t.initialize(f.binding),rejected=expect(pending).rejects.toThrow('platform_image_native_unavailable');
  await vi.advanceTimersByTimeAsync(15001);await rejected;expect(cancel).toHaveBeenCalledOnce();
 });

});
