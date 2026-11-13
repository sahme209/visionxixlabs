import 'server-only';
import {assertExecutionWindow,type ExecutionTimeSource,type ExecutionTimeCheck} from './executionTime';
import {readPlatformPrincipalTimeWindow} from './principalTime';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import type {PlatformRepository,PlatformAuthority,PlatformTransaction} from './actionStore';
import {platformPrincipalSchema,type PlatformPrincipal} from './contracts';
import {platformActionId} from './viewContract';
import {readPlatformAction,claimPlatformAction,finishPlatformAction} from './kernel';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import {templateBindingForParent,type TemplateExpiryQualification} from './templateStorageSql';
import {readTemplateReservation} from './templateLiability';
import {readTemplateExecutionReceipt,createTemplateExecutionReceipt,nativeTemplateKey,type TemplateExecutionBinding} from './templateExecutionContract';
import {templateSelectionFromBinding,templateExecutionProfile,prepareTemplateExecutionPlan} from './templateExecutionPreparation';
import type {TemplatePreparationProfiles} from './templatePreparationStore';
import {createTemplateNativeTransport,type TemplateNativePorts,type TemplateNativeObservation} from './templateNativeTransport';
import {deriveTemplateGrantContext,sealTemplateGrant,openTemplateGrant} from './templateGrantArtifact';
export interface TemplateExecutionResources{
 profiles:TemplatePreparationProfiles;
 clock:ExecutionTimeSource;
 assertDispatchCurrent?:TemplateNativePorts['assertDispatchCurrent'];
 assertCredentialCurrent?:TemplateNativePorts['assertCredentialCurrent'];
 assertQualified(binding:Readonly<TemplateExecutionBinding>):Promise<void>;
 readCredential:TemplateNativePorts['readCredential'];
 now():number;
 readArtifactKey?(binding:Readonly<TemplateExecutionBinding>):Uint8Array;
 assertArtifactKeyCurrent?(binding:Readonly<TemplateExecutionBinding>):Promise<void>;
 /** Must bind the exact live authenticated response/native channel to this
  * original requester/session and artifact. Missing/unqualified always refuses. */
 assertDeliveryChannel?(binding:Readonly<TemplateExecutionBinding>,artifactRef:string):Promise<void>;
 expiryQualification?(binding:Readonly<TemplateExecutionBinding>):Promise<TemplateExpiryQualification|undefined>;
}
const fail=(code='platform_template_execution_unavailable'):never=>{throw Error(code)};
/** Prepared private service only. There is no qualified production supplier or
 * public route. Test ports cannot become JSON authority. Native results enter
 * only through the real adapter's private once-only observation capability. */
export function createTemplateExecutionStore(repo:PlatformRepository,authority:PlatformAuthority,resources?:TemplateExecutionResources,signal?:AbortSignal){
 const clock=resources?.clock,nativeDispatch=resources?.assertDispatchCurrent?.bind(resources),nativeCredential=resources?.assertCredentialCurrent?.bind(resources);
 function controllingSignal(){if(!(signal instanceof AbortSignal)||signal.aborted)return fail();return signal}
 async function joinedTime(tx:PlatformTransaction,state:ReturnType<typeof readPlatformAction>,expiresAt=Date.parse(state.plan.expiresAt),check?:ExecutionTimeCheck){
  const active=controllingSignal();if(!state.reviewer||typeof clock!=='function')return fail();
  const requester=await readPlatformPrincipalTimeWindow(tx,state.requester,active),reviewer=await readPlatformPrincipalTimeWindow(tx,state.reviewer,active);
  const window=Object.freeze({notBefore:Math.max(requester.notBefore,reviewer.notBefore),expiresAt:Math.min(expiresAt,Date.parse(state.plan.expiresAt),requester.expiresAt,reviewer.expiresAt)});
  if(check)await check(window);else await assertExecutionWindow(clock,window,active);active.throwIfAborted();await people(tx,state);
 }
 async function locked<T>(id:string,fn:(tx:PlatformTransaction,state:ReturnType<typeof readPlatformAction>)=>Promise<T>){platformActionId.parse(id);return repo.transaction(async tx=>{await tx.lock(id);return fn(tx,readPlatformAction(await tx.read(id)))})}
 function storage(tx:PlatformTransaction){return tx.templateStorage??fail()}
 async function binding(tx:PlatformTransaction,id:string,state:ReturnType<typeof readPlatformAction>){if(!tx.readTemplateBinding)return fail();const raw=await tx.readTemplateBinding(id);if(!raw)return fail();return templateBindingForParent(raw,state,id)}
 async function people(tx:PlatformTransaction,state:ReturnType<typeof readPlatformAction>){await authority.assertCurrent(tx,state.requester);if(!state.reviewer)return fail();await authority.assertCurrent(tx,state.reviewer)}
 async function timely(tx:PlatformTransaction,state:ReturnType<typeof readPlatformAction>,b:Readonly<TemplateExecutionBinding>){const now=await tx.now();if(!Number.isSafeInteger(now)||now<state.updatedAt||now>=Date.parse(state.plan.expiresAt))return fail();if(b.access&&resources){const native=resources.now();if(!Number.isSafeInteger(native)||Math.abs(native-now)>b.access.clockSkewMs)return fail()}return now}
 async function sourceCurrent(tx:PlatformTransaction,id:string,state:ReturnType<typeof readPlatformAction>,b:Readonly<TemplateExecutionBinding>,actor:PlatformPrincipal){if(!resources||hash(state.requester)!==hash(actor)||hash(await binding(tx,id,state))!==hash(b))return fail();await people(tx,state);await timely(tx,state,b);const selection=templateSelectionFromBinding(b),profile=templateExecutionProfile.parse(await resources.profiles.read(selection));await resources.profiles.assertQualified(profile,selection);const prepared=await prepareTemplateExecutionPlan(selection,await timely(tx,state,b),id,state.requester,profile);if(hash(prepared.binding)!==hash(b))return fail();await resources.assertQualified(b);await resources.profiles.assertQualified(profile,selection);await people(tx,state);await timely(tx,state,b)}
 async function current(tx:PlatformTransaction,id:string,state:ReturnType<typeof readPlatformAction>,b:Readonly<TemplateExecutionBinding>,actor:PlatformPrincipal){await sourceCurrent(tx,id,state,b,actor);await joinedTime(tx,state);await sourceCurrent(tx,id,state,b,actor)}
 return {
  async history(id:string,rawActor:PlatformPrincipal){const actor=platformPrincipalSchema.parse(rawActor);return locked(id,async(tx,state)=>{await authority.assertCurrent(tx,actor);const b=await binding(tx,id,state),receipts=(await storage(tx).receipts()).map(readTemplateExecutionReceipt);for(const r of receipts)if(r.bindingDigest!==b.bindingDigest||r.planDigest!==b.planDigest||r.sourceDigest!==b.sourceDigest||r.profileDigest!==b.profileDigest||r.nativeKey!==nativeTemplateKey(b.effect,b.requester)||r.effectIndex!==b.effectIndex)return fail();const deliveries=(await storage(tx).deliveries()).map(c=>({artifactRef:c.artifactRef,generation:c.generation,phase:'output_attempt_claimed' as const,attempt:c.attempt,claimedAt:c.claimedAt,clientReceiptConfirmed:false as const}));await authority.assertCurrent(tx,actor);return Object.freeze({actionId:id,status:state.status,attemptCount:state.attemptCount,receipts,deliveries,authority:'template_history_only' as const,sourceValidation:'not_checked' as const,executionAuthorized:false as const})})},
  /** Separate original-session output. The claim commits before key copying
   * or decryption. No public history path reads an envelope or bearer URL. */
  async deliver(id:string,artifactRef:string,rawActor:PlatformPrincipal){const actor=platformPrincipalSchema.parse(rawActor);if(!resources?.assertDeliveryChannel||!resources.readArtifactKey||!resources.assertArtifactKeyCurrent)return fail('platform_template_delivery_unavailable');const r=resources,channel=resources.assertDeliveryChannel,keyCurrent=resources.assertArtifactKeyCurrent,readKey=resources.readArtifactKey;let key:Buffer|undefined;
   try{
    const saved=await locked(id,async(tx,state)=>{if(state.status!=='confirmed')return fail();const b=await binding(tx,id,state);if(!b.access||b.effect.kind!=='template.access.grant')return fail();await current(tx,id,state,b,actor);await channel(b,artifactRef);await keyCurrent(b);await current(tx,id,state,b,actor);return storage(tx).claimDelivery(artifactRef,actor)});
    // No plaintext/key is copied unless the claim's commit was acknowledged.
    const b=saved.context.binding,detail=saved.context.receipt.detail;if(detail?.kind!=='access'||detail.artifactRef!==artifactRef||b.actionId!==id)return fail();const hardExpiresAt=detail.hardExpiresAt;
    async function checkTime(tx:PlatformTransaction,state:ReturnType<typeof readPlatformAction>){const now=await timely(tx,state,b);if(now<saved.claim.claimedAt||now>=hardExpiresAt)return fail();await joinedTime(tx,state,hardExpiresAt)}
    async function live(){await locked(id,async(tx,state)=>{if(state.status!=='confirmed')return fail();await current(tx,id,state,b,actor);await checkTime(tx,state)});await channel(b,artifactRef);await keyCurrent(b);await locked(id,async(tx,state)=>{if(state.status!=='confirmed')return fail();await current(tx,id,state,b,actor);await checkTime(tx,state)});await channel(b,artifactRef);await locked(id,async(tx,state)=>{if(state.status!=='confirmed'||hash(await binding(tx,id,state))!==hash(b)||hash(state.requester)!==hash(actor))return fail();await people(tx,state);await checkTime(tx,state);await sourceCurrent(tx,id,state,b,actor);await channel(b,artifactRef);await keyCurrent(b);await people(tx,state)})}
    function sameKey(){if(!key)return fail();const raw=readKey(b);if(!(raw instanceof Uint8Array)||raw.byteLength!==32)return fail();const copy=Buffer.from(raw);try{if(!timingSafeEqual(copy,key))return fail()}finally{copy.fill(0)}}
    await live();const raw=readKey(b);if(!(raw instanceof Uint8Array)||raw.byteLength!==32)return fail();key=Buffer.from(raw);await live();sameKey();const url=openTemplateGrant(key,saved.context,saved.envelope);await live();sameKey();
    return Object.freeze({actionId:id,artifactRef,url,hardExpiresAt,serverOutputAttempted:true as const,clientReceiptConfirmed:false as const,authority:'one_use_original_session_output' as const});
   }catch{return fail('platform_template_delivery_unavailable')}finally{key?.fill(0)}
  },
  async execute(id:string,version:number,rawActor:PlatformPrincipal){const actor=platformPrincipalSchema.parse(rawActor);if(!resources)return fail();const r=resources;
   const b=await locked(id,async(tx,state)=>{if(state.status!=='approved'||state.version!==version)return fail();const value=await binding(tx,id,state);await current(tx,id,state,value,actor);return value});
   let admitted:ReturnType<typeof readTemplateReservation>|undefined,key:Buffer|undefined,nativeFinished=false;
   async function checkKey(nativeGuard=false){if(nativeGuard&&nativeFinished)return fail();if(!b.access)return;if(!r.readArtifactKey||!r.assertArtifactKeyCurrent)return fail();await r.assertArtifactKeyCurrent(b);if(nativeGuard&&nativeFinished)return fail();if(key){const raw=r.readArtifactKey(b);if(!(raw instanceof Uint8Array)||raw.byteLength!==32)return fail();const copy=Buffer.from(raw);try{if(!timingSafeEqual(copy,key))return fail()}finally{copy.fill(0)}}}
   async function externalCurrent(terminal=false,nativeGuard=false,timeCheck?:ExecutionTimeCheck){if(nativeGuard&&nativeFinished)return fail();await locked(id,async(tx,state)=>{if(terminal?state.status!=='confirmed':!['approved','claimed'].includes(state.status))return fail();await current(tx,id,state,b,actor)});if(nativeGuard&&nativeFinished)return fail();await checkKey(nativeGuard);await locked(id,async(tx,state)=>{if((terminal?state.status!=='confirmed':!['approved','claimed'].includes(state.status))||hash(state.requester)!==hash(actor)||hash(await binding(tx,id,state))!==hash(b))return fail();await people(tx,state);await timely(tx,state,b);await joinedTime(tx,state,Date.parse(b.approvalExpiresAt),timeCheck);await sourceCurrent(tx,id,state,b,actor);await checkKey(nativeGuard);await timely(tx,state,b);await people(tx,state)});if(nativeGuard&&nativeFinished)return fail()}

   const transport=createTemplateNativeTransport({
    assertDispatchCurrent:nativeDispatch,assertCredentialCurrent:nativeCredential,
    assertQualified:async()=>{await r.assertQualified(b);await checkKey(true)},assertCurrent:async(_binding,check)=>externalCurrent(false,true,check),clock:clock!,signal:controllingSignal(),readCredential:binding=>{if(nativeFinished)return fail();return r.readCredential(binding)},now:()=>r.now(),
    admit:async()=>{
     const committed=await locked(id,async(tx,state)=>{if(state.status!=='approved'||state.version!==version)return fail();await current(tx,id,state,b,actor);const now=await timely(tx,state,b),claimed=claimPlatformAction(state,actor,now);await tx.replace(id,state.version,claimed);await tx.writeEffect(id,b.effectIndex,null,'claimed');await tx.event({actionId:id,kind:'claimed',state:claimed});await tx.event({actionId:id,kind:'effect.claimed',state:claimed,effectIndex:b.effectIndex});const qualification=await r.expiryQualification?.(b),held=await storage(tx).reserve(b,qualification);await current(tx,id,claimed,b,actor);return held});
     // Assignment occurs only after the transaction acknowledges its commit.
     // A lost acknowledgement can leave a durable hold but grants no key/send.
     if(nativeFinished)return fail();admitted=committed;await externalCurrent(false,true);if(b.access){await checkKey(true);if(nativeFinished)return fail();const raw=r.readArtifactKey!(b);if(!(raw instanceof Uint8Array)||raw.byteLength!==32)return fail();key=Buffer.from(raw);await checkKey(true);await externalCurrent(false,true)}
    },
   });
   try{
    let native:Readonly<TemplateNativeObservation>|null=null;
    try{const proof=await transport.perform(b);native=transport.consume(proof,b)}catch{/* Consumed native uncertainty is recorded once below, never retried. */}finally{nativeFinished=true}
    if(!admitted)return fail('platform_template_admission_unconfirmed');
    let receipt:ReturnType<typeof createTemplateExecutionReceipt>;
    try{
     receipt=await locked(id,async(tx,state)=>{if(state.status!=='claimed'||await tx.readEffect(id,b.effectIndex)!=='claimed'||hash(await binding(tx,id,state))!==hash(b))return fail();const saved=await storage(tx).readResource(admitted!.nativeKey);if(!saved||hash(saved)!==hash(admitted))return fail();const observedAt=await tx.now();let detail:unknown=null;
      if(native?.kind==='bucket'||native?.kind==='object')detail=native;
      else if(native?.kind==='access'){if(!b.access||!key)return fail();await checkKey();detail={kind:'access',grantId:b.access.grantId,artifactRef:'platform_template_artifact_'+randomUUID(),artifactProfileDigest:b.access.artifactProfileDigest,signedAt:native.signedAt,ttlSeconds:native.ttlSeconds,hardExpiresAt:native.hardExpiresAt,clockSkewMs:b.access.clockSkewMs}}
      const outcome=native?'confirmed':'unknown',value=createTemplateExecutionReceipt({format:1,purpose:'platform_template_execution_receipt_v1',receiptId:'platform_template_receipt_'+randomUUID(),nativeKey:admitted!.nativeKey,bindingDigest:b.bindingDigest,actionId:id,effectIndex:b.effectIndex,planDigest:b.planDigest,sourceDigest:b.sourceDigest,profileDigest:b.profileDigest,generation:admitted!.generation,operation:b.effect.kind==='template.bucket.create'?'create_bucket':b.effect.kind==='template.object.put'?'upload':'access',outcome,observedAt,detail});
      const envelope=native?.kind==='access'?sealTemplateGrant(key,deriveTemplateGrantContext(saved,value,observedAt),native.url):undefined;
      await storage(tx).record(value,envelope);await tx.writeEffect(id,b.effectIndex,'claimed',outcome);const next=finishPlatformAction(state,outcome,await tx.now());await tx.replace(id,state.version,next);await tx.event({actionId:id,kind:'effect.observed',state:next,effectIndex:b.effectIndex,outcome,templateReceipt:value});return value;
     });
    }catch{return fail('platform_template_outcome_unconfirmed')}
    // This catch is deliberately outside native/outcome handling: never issue a
    // second write to conceal a committed/lost reply or a late revocation.
    if(receipt.outcome!=='confirmed')return fail('platform_template_native_unconfirmed');
    try{await externalCurrent(true)}catch{return fail('platform_template_result_unavailable')}
    return Object.freeze({actionId:id,receipt,authority:'template_receipt_only' as const,delivered:false as const});
   }finally{key?.fill(0)}
  },
 };
}
