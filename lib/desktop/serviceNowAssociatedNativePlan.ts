import 'server-only';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {parseServiceNowTicketActionCandidate,type ServiceNowTicketActionCandidate} from '@/lib/releaseops/serviceNowTicketLifecycleContract';
import type {ServiceNowTicketScope} from '@/lib/releaseops/serviceNowTicketLifecycleStore';
import {validateServiceNowMetadata,serviceNowProcessSchemaDigest,buildServiceNowNativeClosePlan,type ServiceNowTrustedConnection,type ServiceNowTrustedCloseMetadata} from './serviceNowTicketLifecyclePreparation';
type Candidate=Readonly<ServiceNowTicketActionCandidate>;
/** Read-only native validation, invoked outside durable transaction locks. The
 * original and terminal-policy metadata ports must enforce current saved reviews.
 * The provider remains the final validator of custom instance rules. */
export function createServiceNowAssociatedNativePlan(ports:{
 assertCurrent:(scope:Readonly<ServiceNowTicketScope>,candidate:Candidate,signal:AbortSignal)=>Promise<void>;
 readOriginal:(scope:Readonly<ServiceNowTicketScope>,candidate:Candidate,signal:AbortSignal)=>Promise<unknown>;
 readMetadata:(scope:Readonly<ServiceNowTicketScope>,connection:ServiceNowTrustedConnection,signal:AbortSignal)=>Promise<unknown>;
 readCloseMetadata:(scope:Readonly<ServiceNowTicketScope>,candidate:Extract<ServiceNowTicketActionCandidate,{kind:'close'}>,signal:AbortSignal)=>Promise<ServiceNowTrustedCloseMetadata>;
},options:{now?:()=>number}={}){
 const now=options.now??Date.now;
 return async(scope:Readonly<ServiceNowTicketScope>,raw:unknown,signal:AbortSignal):Promise<void|{terminalStateValues:readonly string[]}>=>{
  const c=parseServiceNowTicketActionCandidate(raw);if(c.kind==='publish'||!c.association||c.organizationId!==scope.organizationId||Date.parse(c.expiresAt)<=now())throw Error('servicenow_associated_native_unavailable');
  await ports.assertCurrent(scope,c,signal);signal.throwIfAborted();
  const connection={organizationId:c.organizationId,connectionId:c.connectionId,connectionRevision:c.connectionRevision,instanceOrigin:c.instanceOrigin,consentedByUserId:scope.actorUserId};
  if(c.kind==='link'){
   const original=parseServiceNowTicketActionCandidate(await ports.readOriginal(scope,c,signal));
   if(original.kind!=='publish'||original.validationAuthority!=='native_submission'||original.organizationId!==c.organizationId||original.releaseId!==c.releaseId||original.releaseVersion!==c.releaseVersion||original.sourceDigest!==c.sourceDigest||original.connectionId!==c.connectionId||original.instanceOrigin!==c.instanceOrigin||original.schemaDigest!==c.schemaDigest)throw Error('servicenow_associated_original_changed');
   const metadata=validateServiceNowMetadata(await ports.readMetadata(scope,connection,signal),connection,now());
   if(metadata.validationAuthority!=='native_submission')throw Error('servicenow_native_authority_changed');
   const matches=metadata.processes.filter(p=>sha256ContentHash(p.nativeProcess)===sha256ContentHash(original.nativeProcess));
   if(matches.length!==1||serviceNowProcessSchemaDigest(matches[0])!==c.schemaDigest)throw Error('servicenow_native_model_changed');
   await ports.assertCurrent(scope,c,signal);signal.throwIfAborted();return;
  }
  if(!c.terminalPolicy||!c.linkedEvidenceActionId)throw Error('servicenow_closure_reviews_required');
  const metadata=await ports.readCloseMetadata(scope,c,signal),native=buildServiceNowNativeClosePlan(connection,c.issue,metadata,{transitionId:c.transition.id,...(c.payload.close_code!==undefined?{closeCode:c.payload.close_code}:{}),...(c.payload.close_notes!==undefined?{closeNotes:c.payload.close_notes}:{}),clientRequestId:'00000000-0000-4000-8000-000000000000'},now());
  if(native.schemaDigest!==c.schemaDigest||sha256ContentHash(native.transition)!==sha256ContentHash(c.transition)||sha256ContentHash(native.payload)!==c.payloadDigest)throw Error('servicenow_native_close_changed');
  await ports.assertCurrent(scope,c,signal);signal.throwIfAborted();return{terminalStateValues:[...metadata.verifiedTerminalStateValues]};
 };
}
