import {it,expect,vi} from 'vitest';
import {createImageWorkflowRequestComposition} from '../imageWorkflowRequest';
import {createImageArtifactService} from '../imageArtifactService';
import type {PlatformRepository,PlatformTransaction} from '../actionStore';
import type {PlatformAction} from '../contracts';
import type {ImageArtifactMetadata,ImageUploadBinding} from '../imageCustodyContract';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
const actor={userId:'requester',sessionId:'requester-session'},reviewer={userId:'reviewer',sessionId:'reviewer-session'},reference='11111111-1111-4111-8111-111111111111',actionReference='22222222-2222-4222-8222-222222222222',digest='a'.repeat(64);
function fixture(){
 const now=Date.now(),artifacts=new Map<string,{metadata:ImageArtifactMetadata;envelope:string;createdAt:number}>(),actions=new Map<string,PlatformAction>(),bindings=new Map<string,ImageUploadBinding>(),key=Buffer.alloc(32,7),profile={profileId:'fixture',profileDigest:'b'.repeat(64),destinationOrigin:'https://www.linkedin.com'};
 const connection={id:'connection',linkedinUrn:'urn:li:person:author',organizationUrn:null,scopes:'w_member_social',status:'connected',expiresAt:new Date(now+120000),updatedAt:new Date(now-1000)};
 let readerExpiry=now+60000,qualified=true;
 const repo:PlatformRepository={transaction:async fn=>{const a=new Map(artifacts),states=new Map(actions),bound=new Map(bindings);
  const tx={lock:async()=>{},now:async()=>now,readSessionPrincipal:async(sessionId:string)=>sessionId===actor.sessionId?actor:sessionId===reviewer.sessionId?reviewer:null,readImageConnection:async()=>connection,readPrincipal:async(p:typeof actor)=>({...p,email:p.userId+'@example.test',live:true,sessionIssuedAtMs:now-1000,sessionExpiresAtMs:p.userId===reviewer.userId?readerExpiry:now+120000}),read:async(id:string)=>states.get(id)??null,readImageBinding:async(id:string)=>bound.get(id)??null,insert:async(id:string,s:PlatformAction)=>{if(states.has(id))throw Error('exists');states.set(id,s)},replace:async(id:string,v:number,s:PlatformAction)=>{if(states.get(id)?.version!==v)throw Error('stale');states.set(id,s)},event:async(e:{actionId:string;imageBinding?:ImageUploadBinding})=>{if(e.imageBinding)bound.set(e.actionId,e.imageBinding)},imageStorage:{readArtifact:async(id:string)=>a.get(id)??null,insertArtifact:async(m:ImageArtifactMetadata,envelope:string,createdAt:number)=>{if(a.has(m.artifactId))throw Error('exists');a.set(m.artifactId,{metadata:m,envelope,createdAt})},artifactMatches:async(b:ImageUploadBinding)=>{const saved=a.get(b.artifact.artifactId);if(!saved||hash(saved.metadata)!==hash(b.artifact))throw Error('mismatch');return saved}}} as unknown as PlatformTransaction;
  const result=await fn(tx);artifacts.clear();for(const [k,v] of a)artifacts.set(k,v);actions.clear();for(const [k,v] of states)actions.set(k,v);bindings.clear();for(const [k,v] of bound)bindings.set(k,v);return result;
 }},authority={assertCurrent:async()=>{}},resources={clock:vi.fn(async()=>({earliest:now,latest:now+1})),decoder:{profileDigest:digest,assertQualified:async()=>{if(!qualified)throw Error('decoder revoked')},inspect:vi.fn(async(_bytes:Uint8Array,mimeType:string)=>({mimeType,width:1,height:1,formatProfileDigest:digest}))},readKey:vi.fn(async()=>key),assertKeyCurrent:async()=>{if(!qualified)throw Error('key revoked')},readUploadProfile:async()=>profile,assertUploadProfileCurrent:async()=>{if(!qualified)throw Error('profile revoked')}};
 return {now,resources,key,actions,repo,authority,setReaderExpiry:(v:number)=>{readerExpiry=v},revoke:()=>{qualified=false},service:createImageArtifactService(repo,authority,resources,new AbortController().signal)};
}
async function proposed(f:ReturnType<typeof fixture>){const artifact=await f.service.intake({connectionId:'connection',mimeType:'image/png',requestReference:reference},Buffer.from('synthetic image'),actor);return f.service.prepare(artifact.artifact.artifactId,new Date(f.now+30000).toISOString(),actionReference,actor)}
it('uses the actual intake/proposal/private-preview/review path without requiring a reviewer before assignment',async()=>{
 const f=fixture(),p=await proposed(f),view=await f.service.preview(p.actionId,reviewer);expect(view.bytes.toString()).toBe('synthetic image');expect(view.state.reviewer).toBeNull();view.bytes.fill(0);await f.service.review(p.actionId,0,view.state.plan.digest,reviewer);expect(f.actions.get(p.actionId)).toMatchObject({status:'approved',reviewer,attemptCount:0});expect(f.key.equals(Buffer.alloc(32,7))).toBe(true);
});
it('blocks an expired preview reader before key access or decryption',async()=>{
 const f=fixture(),p=await proposed(f);f.setReaderExpiry(f.now+1000);f.resources.clock.mockResolvedValue({earliest:f.now,latest:f.now+1000});const reads=f.resources.readKey.mock.calls.length,inspects=f.resources.decoder.inspect.mock.calls.length;
 await expect(f.service.preview(p.actionId,reviewer)).rejects.toThrow();expect(f.resources.readKey).toHaveBeenCalledTimes(reads);expect(f.resources.decoder.inspect).toHaveBeenCalledTimes(inspects);expect(f.actions.get(p.actionId)?.status).toBe('proposed');
});
it('retains the exact action deadline across an awaited key read before decrypting preview bytes',async()=>{
 const f=fixture(),p=await proposed(f),reads=f.resources.readKey.mock.calls.length,inspects=f.resources.decoder.inspect.mock.calls.length;f.resources.clock.mockImplementation(async()=>({earliest:f.now,latest:f.resources.readKey.mock.calls.length>reads?f.now+30000:f.now+1}));
 await expect(f.service.preview(p.actionId,reviewer)).rejects.toThrow();expect(f.resources.readKey).toHaveBeenCalledTimes(reads+1);expect(f.resources.decoder.inspect).toHaveBeenCalledTimes(inspects);expect(f.actions.get(p.actionId)?.status).toBe('proposed');
});
it('cannot switch to a replacement clock callback after the private source becomes unavailable',async()=>{
 const f=fixture(),p=await proposed(f);f.resources.clock.mockRejectedValue(Error('source unavailable'));const original=f.resources.clock;f.resources.clock=vi.fn(async()=>({earliest:f.now,latest:f.now+1}));await expect(f.service.preview(p.actionId,reviewer)).rejects.toThrow();expect(original).toHaveBeenCalled();
});

it.each(['same','different'])('enforces one captured clock policy in the composed image workflow: %s',async mode=>{
 const f=fixture(),execution={...f.resources,clock:mode==='same'?f.resources.clock:vi.fn(async()=>({earliest:f.now,latest:f.now+1})),version:'202607',now:()=>f.now,assertNativeQualified:async()=>{},assertObservationAllowed:async()=>{},readCredential:async()=> 'SYNTHETIC',assertCredentialCurrent:async()=>{},readGrantKey:async()=>f.key,assertGrantKeyCurrent:async()=>{}};
 const service=await createImageWorkflowRequestComposition({headers:new Headers({authorization:'Bearer synthetic'}),signal:new AbortController().signal},{repo:f.repo,verifyDesktopToken:()=>({sessionId:actor.sessionId}),readAdminEmails:()=>['requester@example.test','reviewer@example.test'],resources:f.resources,executionResources:execution});
 if(mode==='same'){const result=await service.intake({connectionId:'connection',mimeType:'image/png',requestReference:reference},Buffer.from('synthetic image'));expect(result.artifact.creatorUserId).toBe(actor.userId);expect(f.resources.decoder.inspect).toHaveBeenCalled()}else{await expect(service.intake({connectionId:'connection',mimeType:'image/png',requestReference:reference},Buffer.from('synthetic image'))).rejects.toThrow();expect(f.resources.decoder.inspect).not.toHaveBeenCalled();expect(f.resources.readKey).not.toHaveBeenCalled()}
});

it('clears the decoded review copy when the action expires across a later joined read',async()=>{
 const f=fixture(),p=await proposed(f);let copy:Uint8Array|undefined;f.resources.decoder.inspect.mockImplementation(async(bytes,mimeType)=>{copy=bytes;return {mimeType,width:1,height:1,formatProfileDigest:digest}});f.resources.clock.mockImplementation(async()=>({earliest:f.now,latest:copy?f.now+30000:f.now+1}));
 await expect(f.service.preview(p.actionId,reviewer)).rejects.toThrow();expect(copy).toBeDefined();expect(Buffer.from(copy!)).toEqual(Buffer.alloc(copy!.byteLength));expect(f.actions.get(p.actionId)?.status).toBe('proposed');expect(f.key.equals(Buffer.alloc(32,7))).toBe(true);
});
