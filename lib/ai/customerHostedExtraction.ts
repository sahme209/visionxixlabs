import {createHash} from 'node:crypto';
import {boundedStructuredAIInput} from './inputByteBound';
import {redactSecrets} from './contextRedaction';
import {readInstallationAIMode,type CustomerHostedOperatorConfig} from './customerHostedConfig';
import {CustomerHostedResponseError} from './customerHostedProtocol';
import type {sendCustomerHostedCompletion} from './customerHostedTransport';
import type {createCustomerHostedTokenStore} from './customerHostedTokenStore';
/** Produced by the trusted current-policy AND accepted-limit reader, not by
 * parsing an operator attestation alone. No request may provide this snapshot. */
export interface CustomerHostedExtractionSnapshot {
 readonly config:CustomerHostedOperatorConfig;readonly modelId:string;
 readonly policyDigest:string;readonly windowId:string;readonly reservedTokens:number;
}
interface Dependencies {
 /** Final reader must jointly verify current actor, workspace policy and accepted limits. */
 readCurrent():Promise<CustomerHostedExtractionSnapshot>;
 assertActor():Promise<void>;
 store:ReturnType<typeof createCustomerHostedTokenStore>;
 send:typeof sendCustomerHostedCompletion;
 audit(detail:{settlement:'customer_hosted_unpriced';outcome:'confirmed'|'unknown'|'refused';modelId:string;totalTokens:number|null}):Promise<void>;
}
const fail=()=>new Error('customer_hosted_governed_call_unavailable');
function offline(){if(readInstallationAIMode(process.env.AXIOM_OFFLINE_MODE)!=='offline')throw fail()}
function binding(snapshot:CustomerHostedExtractionSnapshot){return JSON.stringify([snapshot.config.digest,snapshot.modelId,snapshot.policyDigest,snapshot.windowId,snapshot.reservedTokens])}
/** Composed accounting and final-send ordering. Default production authority
 * supplier remains separate; injected tests must not be described as live use. */
export function createCustomerHostedExtraction(scope:{organizationId:string;actorId:string},deps:Dependencies,signal:AbortSignal=new AbortController().signal,beforeAdmission?:()=>Promise<void>){
 return async<T>(rawText:string,schemaHint:string,correlationId:string):Promise<{data:T;usage:{promptTokens:number;completionTokens:number;totalTokens:number}}>=>{
  let claim:object|undefined,outcome:'confirmed'|'unknown'|'refused'='refused',totalTokens:number|null=null,modelId='unavailable';
  try{
   offline();signal.throwIfAborted();
   if(!scope.organizationId||!scope.actorId||!correlationId||correlationId.length>256)throw fail();
   const initial=Object.freeze({...await deps.readCurrent()}),model=initial.config.models.find(m=>m.id===initial.modelId);modelId=initial.modelId;
   if(!model||initial.reservedTokens!==model.maxInputTokens+model.maxOutputTokens||!/^[a-f0-9]{64}$/.test(initial.policyDigest))throw fail();
   const snapshotBinding=binding(initial);
   const payload=boundedStructuredAIInput(redactSecrets(rawText).text,redactSecrets(schemaHint).text);
   const prompt=`${payload.system}\n\n${payload.prompt}`;
   if(Buffer.byteLength(prompt)>model.maxInputBytes)throw fail();
   async function current(){
    offline();signal.throwIfAborted();
    await beforeAdmission?.();await deps.assertActor();
    const latest=await deps.readCurrent();if(binding(latest)!==snapshotBinding)throw fail();
    offline();signal.throwIfAborted();
   }
   await current();
   const request={installationId:initial.config.installationId,organizationId:scope.organizationId,actorId:scope.actorId,
    requestDigest:createHash('sha256').update(JSON.stringify([scope.organizationId,scope.actorId,correlationId,snapshotBinding,prompt])).digest('hex'),
    configDigest:initial.config.digest,modelId,windowId:initial.windowId,reservedTokens:initial.reservedTokens};
   const id=await deps.store.reserveCustomerHostedCall(request);
   let claimAttempted=false;
   const result=await deps.send({config:initial.config,modelId,prompt,signal,beforeSend:async()=>{
    if(claimAttempted)throw fail();claimAttempted=true;
    await current();claim=await deps.store.claimCustomerHostedCall(request,id);outcome='unknown';
    await current();
   }});
   if(!claim)throw fail();
   const consumed=claim;claim=undefined;totalTokens=result.totalTokens;
   await deps.store.settleCustomerHostedCall(consumed,result.totalTokens,true);outcome='confirmed';
   return {data:result.data as T,usage:{promptTokens:result.promptTokens,completionTokens:result.completionTokens,totalTokens:result.totalTokens}};
  }catch(error){
   if(claim){
    const consumed=claim;claim=undefined;
    totalTokens=error instanceof CustomerHostedResponseError?error.usage?.totalTokens??null:null;
    try{await deps.store.settleCustomerHostedCall(consumed,totalTokens,false)}catch{/* dispatched durable hold remains; no retry */}
   }
   // A failed or uncertain attempt must never look like malformed output that
   // grants the Agent a free automatic repair/replay.
   throw fail();
  }finally{
   try{await deps.audit({settlement:'customer_hosted_unpriced',outcome,modelId,totalTokens})}catch{/* durable token transitions remain authoritative */}
  }
 };
}
