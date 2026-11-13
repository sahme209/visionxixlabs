import 'server-only';
import {assertExecutionWindow,type ExecutionTimeSource,type ExecutionTimeCheck} from './executionTime';
import {readPlatformPrincipalTimeWindow} from './principalTime';
import {timingSafeEqual} from 'node:crypto';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {postingConnectionSchema,linkedInConnectionRevision,type PostingConnection} from '@/lib/growth/linkedin/platformPostingPlan';
import type {PlatformRepository,PlatformTransaction,PlatformAuthority} from './actionStore';
import {platformPrincipalSchema,type PlatformPrincipal} from './contracts';
import {platformActionId} from './viewContract';
import {readPlatformAction,claimPlatformAction,finishPlatformAction} from './kernel';
import {imageBindingForParent} from './imageStorageSql';
import {openImageArtifact,openImageUploadGrant,sealImageUploadGrant,imageUploadGrantContext} from './imageCustodyCodec';
import type {ImageUploadBinding} from './imageCustodyContract';
import type {ImageArtifactResources} from './imageArtifactService';
import {createImageNativeTransport,type ImageNativePorts,type ImageNativeObservation} from './imageNativeTransport';

export interface ImageExecutionResources extends ImageArtifactResources {
 version:string;
 assertDispatchCurrent?:ImageNativePorts['assertDispatchCurrent'];
 clock:ExecutionTimeSource;
 now():number;
 assertNativeQualified(binding:Readonly<ImageUploadBinding>,version:string,signal:AbortSignal):Promise<void>;
 /** Receives actual locked connection metadata. A write-only token is not
  * evidence of GET access. Actual native capability qualification is required. */
 assertObservationAllowed(binding:Readonly<ImageUploadBinding>,connection:PostingConnection,signal:AbortSignal):Promise<void>;
 readCredential:ImageNativePorts['readCredential'];
 assertCredentialCurrent:ImageNativePorts['assertCredentialCurrent'];
 readGrantKey(binding:Readonly<ImageUploadBinding>,signal:AbortSignal):Promise<Uint8Array>;
 assertGrantKeyCurrent(binding:Readonly<ImageUploadBinding>,key:Uint8Array,signal:AbortSignal):Promise<void>;
}
const fail=():never=>{throw Error('platform_image_execution_unavailable');};
type State=ReturnType<typeof readPlatformAction>;
function scope(milliseconds:number,parent?:AbortSignal){
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),milliseconds),buffers:Buffer[]=[];
 const signal=AbortSignal.any([abort.signal,...(parent?[parent]:[])]);let closed=false;
 const check=()=>{if(closed)return fail();signal.throwIfAborted()};
 const clear=()=>{for(const b of buffers)b.fill(0)};signal.addEventListener('abort',clear,{once:true});
 return {signal,check,own(b:Buffer){check();buffers.push(b);return b},async within<T>(fn:()=>Promise<T>):Promise<T>{check();const result=await withGithubAbort(Promise.resolve().then(()=>{check();return fn()}),signal);check();return result},close(){closed=true;clearTimeout(timer);abort.abort();signal.removeEventListener('abort',clear);clear()}};
}
type Scope=ReturnType<typeof scope>;
/** Unregistered private executor. Native results originate only in this store's
 * fixed adapter, never a caller observation command. No real resource supplier
 * exists by default. Source tests cannot enable production custody or transport. */
export function createImageExecutionStore(repo:PlatformRepository,authority:PlatformAuthority,resources?:ImageExecutionResources,requestSignal?:AbortSignal){
 const fixedVersion=resources?.version,clock=resources?.clock,nativeDispatch=resources?.assertDispatchCurrent?.bind(resources);
 function storage(tx:PlatformTransaction){return tx.imageStorage??fail()}
 async function locked<T>(id:string,c:Scope,fn:(tx:PlatformTransaction,state:State)=>Promise<T>){platformActionId.parse(id);return c.within(()=>repo.transaction(async tx=>{await c.within(()=>tx.lock(id));return fn(tx,readPlatformAction(await c.within(()=>tx.read(id))))}))}
 async function binding(tx:PlatformTransaction,id:string,state:State,c:Scope){if(!tx.readImageBinding)return fail();return imageBindingForParent(await c.within(()=>tx.readImageBinding!(id)),state,id)}
 async function people(tx:PlatformTransaction,state:State,c:Scope){if(!state.reviewer)return fail();for(const p of [state.requester,state.reviewer])await c.within(()=>authority.assertCurrent(tx,p))}
 async function time(tx:PlatformTransaction,state:State,c:Scope){const now=await c.within(()=>tx.now());if(!Number.isSafeInteger(now)||now<state.updatedAt||now>=Date.parse(state.plan.expiresAt))return fail();return now}
 async function sourceCurrent(tx:PlatformTransaction,id:string,state:State,b:Readonly<ImageUploadBinding>,actor:PlatformPrincipal,c:Scope){
  if(!resources||resources.version!==fixedVersion||hash(state.requester)!==hash(actor)||hash(await binding(tx,id,state,c))!==hash(b)||!tx.readImageConnection)return fail();
  await people(tx,state,c);const now=await time(tx,state,c);
  const connection=postingConnectionSchema.parse(await c.within(()=>tx.readImageConnection!(b.artifact.connectionId)));
  const author=connection.organizationUrn||connection.linkedinUrn,scopes=connection.scopes.split(/[\s,]+/).filter(Boolean);
  if(connection.id!==b.artifact.connectionId||connection.status!=='connected'||connection.expiresAt.getTime()<=now||author!==b.artifact.author||linkedInConnectionRevision(connection)!==b.artifact.connectionRevision||!scopes.includes(connection.organizationUrn?'w_organization_social':'w_member_social')||scopes.length===1&&scopes[0]==='w_member_social')return fail();
  await c.within(()=>resources.assertObservationAllowed(b,connection,c.signal));
  if(!resources.readUploadProfile||!resources.assertUploadProfileCurrent)return fail();
  const profile=await c.within(()=>resources.readUploadProfile!(b.artifact,c.signal));
  if(hash(profile)!==hash(b.profile))return fail();
  await c.within(()=>resources.assertUploadProfileCurrent!(profile,b.artifact,c.signal));
  if(resources.decoder.profileDigest!==b.artifact.formatProfileDigest)return fail();
  await c.within(()=>resources.decoder.assertQualified(b.artifact.formatProfileDigest,c.signal));
  await c.within(()=>resources.assertNativeQualified(b,resources.version,c.signal));
  await people(tx,state,c);await time(tx,state,c);if(resources.version!==fixedVersion||resources.decoder.profileDigest!==b.artifact.formatProfileDigest)return fail();return connection;
 }
 async function current(tx:PlatformTransaction,id:string,state:State,b:Readonly<ImageUploadBinding>,actor:PlatformPrincipal,c:Scope,check?:ExecutionTimeCheck){
  const connection=await sourceCurrent(tx,id,state,b,actor,c);if(!state.reviewer||typeof clock!=='function')return fail();
  const requester=await c.within(()=>readPlatformPrincipalTimeWindow(tx,state.requester,c.signal)),reviewer=await c.within(()=>readPlatformPrincipalTimeWindow(tx,state.reviewer!,c.signal));
  const window=Object.freeze({notBefore:Math.max(requester.notBefore,reviewer.notBefore),expiresAt:Math.min(Date.parse(b.expiresAt),requester.expiresAt,reviewer.expiresAt,connection.expiresAt.getTime())});
  if(check)await c.within(()=>check(window));else await c.within(()=>assertExecutionWindow(clock,window,c.signal));
  await sourceCurrent(tx,id,state,b,actor,c);
 }
 async function withKey<T>(c:Scope,read:()=>Promise<Uint8Array>,assert:(key:Buffer)=>Promise<void>,fn:(key:Buffer)=>Promise<T>){
  const raw=await c.within(read);if(!(raw instanceof Uint8Array)||raw.byteLength!==32)return fail();const key=c.own(Buffer.from(raw));
  try{await c.within(()=>assert(key));const result=await fn(key);await c.within(()=>assert(key));const latest=await c.within(read);if(!(latest instanceof Uint8Array)||latest.byteLength!==32)return fail();const copy=c.own(Buffer.from(latest));try{if(!timingSafeEqual(key,copy))return fail()}finally{copy.fill(0)}return result}finally{key.fill(0)}
 }
 async function recordUnknown(id:string,b:Readonly<ImageUploadBinding>,index:0|1){
  // Truthful recording remains possible after requester cancellation/revocation.
  // It has no credential/source/key access and cannot overwrite terminal work.
  const c=scope(5000);try{return await locked(id,c,async(tx,state)=>{
   if(state.status!=='claimed'||hash(await binding(tx,id,state,c))!==hash(b)||await c.within(()=>tx.readEffect(id,index))!=='claimed')return fail();
   const result=index===1?await c.within(()=>storage(tx).recordPut('unknown')):undefined;
   const next=finishPlatformAction(state,'unknown',await c.within(()=>tx.now()));
   await c.within(()=>tx.writeEffect(id,index,'claimed','unknown'));await c.within(()=>tx.replace(id,state.version,next));
   await c.within(()=>tx.event({actionId:id,kind:'effect.observed',state:next,effectIndex:index,outcome:'unknown',...(result?{imagePutResult:result}:{})}));return next;
  })}finally{c.close()}
 }
 async function execute(id:string,version:number,rawActor:PlatformPrincipal,index:0|1){
  if(!resources||!(requestSignal instanceof AbortSignal)||requestSignal.aborted)return fail();const r=resources,actor=platformPrincipalSchema.parse(rawActor),c=scope(15000,requestSignal);
  let admitted=false,recordingStarted=false,b:Readonly<ImageUploadBinding>|undefined;
  let claimedPut:Awaited<ReturnType<NonNullable<PlatformTransaction['imageStorage']>['claimPut']>>|undefined;
  try{
   b=await locked(id,c,async(tx,state)=>{
    if(state.version!==version||state.status!==(index===0?'approved':'claimed'))return fail();const selected=await binding(tx,id,state,c);
    await current(tx,id,state,selected,actor,c);await c.within(()=>storage(tx).artifactMatches(selected));
    if(index===0){if(await c.within(()=>tx.readEffect(id,0))!==null)return fail()}
    else{const grant=await c.within(()=>storage(tx).readGrant());if(await c.within(()=>tx.readEffect(id,0))!=='confirmed'||await c.within(()=>tx.readEffect(id,1))!==null||!grant||grant.claim||grant.putResult)return fail()}
    await current(tx,id,state,selected,actor,c);return selected;
   });
   const selected=b;
   async function fresh(check?:ExecutionTimeCheck){return locked(id,c,async(tx,state)=>{
    if(state.status!=='claimed')return fail();await current(tx,id,state,selected,actor,c);
    if(index===0)await c.within(()=>storage(tx).assertInitializerHeld(selected));
    else{if(!claimedPut)return fail();await c.within(()=>storage(tx).assertPutHeld(selected,claimedPut!.claim))}
    await current(tx,id,state,selected,actor,c,check);
    if(index===0)await c.within(()=>storage(tx).assertInitializerHeld(selected));
    else{if(!claimedPut)return fail();await c.within(()=>storage(tx).assertPutHeld(selected,claimedPut!.claim))}
    await sourceCurrent(tx,id,state,selected,actor,c);
   })}
   async function admit(){
    if(admitted){await fresh();return}
    const saved=await locked(id,c,async(tx,state)=>{
     if(state.version!==version||state.status!==(index===0?'approved':'claimed'))return fail();await current(tx,id,state,selected,actor,c);
     let claimed=state;
     if(index===0){claimed=claimPlatformAction(state,actor,await time(tx,state,c));await c.within(()=>tx.replace(id,state.version,claimed));await c.within(()=>tx.event({actionId:id,kind:'claimed',state:claimed}))}
     await c.within(()=>tx.writeEffect(id,index,null,'claimed'));await c.within(()=>tx.event({actionId:id,kind:'effect.claimed',state:claimed,effectIndex:index}));
     const put=index===0?(await c.within(()=>storage(tx).reserveInitializer(selected)),undefined):await c.within(()=>storage(tx).claimPut(actor));
     await current(tx,id,claimed,selected,actor,c);return put;
    });
    // Acknowledged commit only. A lost reply can leave a hold, never a send.
    c.check();claimedPut=saved;admitted=true;await fresh();
   }
   const transport=createImageNativeTransport({assertDispatchCurrent:nativeDispatch,version:r.version,clock:clock!,now:()=>r.now(),assertQualified:async(_b,v)=>c.within(()=>r.assertNativeQualified(selected,v,c.signal)),assertObservationAllowed:async()=>{await locked(id,c,async(tx,state)=>current(tx,id,state,selected,actor,c))},assertCurrent:async(_b,_index,_signal,check)=>{if(admitted)await fresh(check);else await locked(id,c,async(tx,state)=>{if(state.status!==(index===0?'approved':'claimed')||state.version!==version)return fail();await current(tx,id,state,selected,actor,c,check)})},admit,readCredential:(_b,i)=>c.within(()=>r.readCredential(selected,i,c.signal)),assertCredentialCurrent:async(_b,key)=>{await c.within(()=>r.assertCredentialCurrent(selected,key,c.signal))}},c.signal);
   let proof:object;
   if(index===0)proof=await transport.initialize(selected);
   else{
    // PUT claim is committed BEFORE artifact/grant key access and decoding.
    await admit();if(!claimedPut)return fail();const saved=claimedPut;
    const bytes=await withKey(c,()=>r.readKey(selected.artifact,c.signal),key=>r.assertKeyCurrent(selected.artifact,key,c.signal),async key=>{
     await fresh();const copy=c.own(openImageArtifact(key,selected.artifact,saved.artifact.envelope));
     const decoded=await c.within(()=>r.decoder.inspect(copy,selected.artifact.mimeType,c.signal));
     const metadata=decoded as {mimeType?:unknown;width?:unknown;height?:unknown;formatProfileDigest?:unknown};
     if(metadata?.mimeType!==selected.artifact.mimeType||metadata.width!==selected.artifact.width||metadata.height!==selected.artifact.height||metadata.formatProfileDigest!==selected.artifact.formatProfileDigest)return fail();
     // The private transport independently rechecks bytes/digest after decode.
     await fresh();return copy;
    });
    const address=await withKey(c,()=>r.readGrantKey(selected,c.signal),key=>r.assertGrantKeyCurrent(selected,key,c.signal),async key=>{await fresh();const value=openImageUploadGrant(key,saved.context,saved.envelope);await fresh();return value});
    proof=await transport.put(selected,saved.context,address,bytes);
   }
   const native:ImageNativeObservation=transport.consume(proof,selected,index);
   // One terminal-observation attempt only. Once started, a lost commit reply
   // is not followed by another write that could conceal the saved outcome.
   recordingStarted=true;
   const result=await locked(id,c,async(tx,state)=>{
    if(state.status!=='claimed')return fail();await current(tx,id,state,selected,actor,c);
    if(index===0){
     if(native.kind!=='initialized')return fail();await c.within(()=>storage(tx).assertInitializerHeld(selected));
     const context=imageUploadGrantContext(selected,{providerImageReference:native.image,issuedAt:native.issuedAt,expiresAt:native.expiresAt});
     await withKey(c,()=>r.readGrantKey(selected,c.signal),key=>r.assertGrantKeyCurrent(selected,key,c.signal),async key=>{
      await current(tx,id,state,selected,actor,c);const envelope=sealImageUploadGrant(key,context,native.address);
      await c.within(()=>storage(tx).recordGrant(context,envelope));await c.within(()=>tx.writeEffect(id,0,'claimed','confirmed'));
      await c.within(()=>tx.event({actionId:id,kind:'effect.observed',state,effectIndex:0,outcome:'confirmed',imageGrantReference:selected.grantReference}));await current(tx,id,state,selected,actor,c);
     });
     await current(tx,id,state,selected,actor,c);
     return Object.freeze({actionId:id,version:state.version,status:'initialized' as const,providerImageReference:native.image,mediaReady:false as const});
    }
    if(native.kind!=='ready'||!claimedPut)return fail();await c.within(()=>storage(tx).assertPutHeld(selected,claimedPut!.claim));
    const receipt=await c.within(()=>storage(tx).recordPut('confirmed',{providerImageReference:native.image,author:native.owner,observedAt:native.observedAt,profileDigest:selected.profile.profileDigest,restVersion:fixedVersion,mediaReady:true}));
    const next=finishPlatformAction(state,'confirmed',await time(tx,state,c));await c.within(()=>tx.writeEffect(id,1,'claimed','confirmed'));await c.within(()=>tx.replace(id,state.version,next));
    await c.within(()=>tx.event({actionId:id,kind:'effect.observed',state:next,effectIndex:1,outcome:'confirmed',imagePutResult:receipt}));await current(tx,id,next,selected,actor,c);
    return Object.freeze({actionId:id,version:next.version,status:'confirmed' as const,receipt,mediaReady:true as const});
   });
   await locked(id,c,async(tx,state)=>{if(state.status!==(index===0?'claimed':'confirmed'))return fail();await current(tx,id,state,selected,actor,c)});
   return result;
  }catch{
   if(admitted&&!recordingStarted&&b){recordingStarted=true;try{await recordUnknown(id,b,index)}catch{/* Original acknowledged claim stays held if recording is uncertain. */}}
   return fail();
  }finally{c.close()}
 }
 return Object.freeze({initialize:(id:string,version:number,actor:PlatformPrincipal)=>execute(id,version,actor,0),put:(id:string,version:number,actor:PlatformPrincipal)=>execute(id,version,actor,1)});
}
