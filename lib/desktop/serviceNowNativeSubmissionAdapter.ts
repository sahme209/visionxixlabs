import 'server-only';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {readServiceNowModels} from '@/lib/integrations/servicenow/serviceNowReadAccess';
import {readServiceNowTicketCredential,type ServiceNowCredentialPort} from './serviceNowTicketCredential';
import {serviceNowConnectionSchema,validateServiceNowMetadata,serviceNowProcessSchemaDigest,type ServiceNowTrustedConnection} from './serviceNowTicketLifecyclePreparation';
import {parseServiceNowTicketActionCandidate} from '@/lib/releaseops/serviceNowTicketLifecycleContract';
import type {ServiceNowTicketScope} from '@/lib/releaseops/serviceNowTicketLifecycleStore';
import type {ServiceNowHttpPorts} from './serviceNowTicketLifecycleHttp';
/** Trusted HTTP composition only: host authorizes the current paired role before
 * and after calls. A reviewer may read the model catalog, never receive secrets
 * or use this read-only credential to execute an owner's action. */
export function createServiceNowNativeSubmissionAdapter(ports:{readConnection:ServiceNowHttpPorts['readConnection'];readCatalogCredential:ServiceNowCredentialPort},options:{fetch?:typeof fetch;now?:()=>number}={}){
 const now=options.now??Date.now,fetcher=options.fetch??fetch;
 async function readMetadata(scope:Readonly<ServiceNowTicketScope>,binding:Readonly<ServiceNowTrustedConnection>,signal:AbortSignal){
  const expected=serviceNowConnectionSchema.parse(binding);
  const current=async()=>{signal.throwIfAborted();const actual=serviceNowConnectionSchema.parse(await ports.readConnection(scope,signal));if(sha256ContentHash(actual)!==sha256ContentHash(expected))throw Error('servicenow_connection_changed')};
  await current();const credential=await readServiceNowTicketCredential(ports.readCatalogCredential,scope,expected,current,signal);
  const catalog=await readServiceNowModels({instanceOrigin:expected.instanceOrigin,token:{accessToken:credential.accessToken,refreshToken:null,expiresAt:credential.expiresAt,scopes:['axiom.change_management']},signal,fetchImpl:fetcher,now});
  await current();const time=now();
  // Name-based native creation cannot disambiguate IDs, including inactive names.
  for(const model of catalog.models.filter(item=>item.active)){const name=model.name.trim().toLowerCase();if(!name||catalog.models.filter(item=>item.name.trim().toLowerCase()===name).length!==1)throw Error('servicenow_native_model_ambiguous')}
  // These requirements describe Axiom's bounded payload, not an assertion that
  // instance UI/data policies have been comprehensively evaluated.
  const {consentedByUserId:_,...metadataBinding}=expected;
  return validateServiceNowMetadata({...metadataBinding,family:'change_request',validationAuthority:'native_submission',observedAt:catalog.observedAt,expiresAt:new Date(Math.min(time+60000,credential.expiresAt)).toISOString(),processes:catalog.models.filter(model=>model.active).map(model=>({label:model.name,nativeProcess:{kind:'model',modelSysId:model.sysId,label:model.name},fields:[{name:'short_description',label:'Short description',required:true,writable:true,type:'string',maxBytes:160},{name:'description',label:'Description',required:false,writable:true,type:'string',maxBytes:8192}]}))},expected,time);
 }
 const assertNativePlan:ServiceNowHttpPorts['assertNativePlan']=async(scope,raw,_context,signal)=>{
  const candidate=parseServiceNowTicketActionCandidate(raw);
  if(candidate.kind!=='publish'||candidate.validationAuthority!=='native_submission')throw Error('servicenow_native_policy_unavailable');
  const connection=serviceNowConnectionSchema.parse(await ports.readConnection(scope,signal)),metadata=await readMetadata(scope,connection,signal);
  if(candidate.organizationId!==scope.organizationId||candidate.connectionId!==connection.connectionId||candidate.connectionRevision!==connection.connectionRevision||candidate.instanceOrigin!==connection.instanceOrigin)throw Error('servicenow_connection_changed');
  const selected=metadata.processes.find(p=>sha256ContentHash(p.nativeProcess)===sha256ContentHash(candidate.nativeProcess));
  if(!selected||serviceNowProcessSchemaDigest(selected)!==candidate.schemaDigest)throw Error('servicenow_native_model_changed');
  if(selected.nativeProcess.kind==='model'){const name=selected.nativeProcess.label?.trim().toLowerCase();if(!name||metadata.processes.filter(p=>p.nativeProcess.kind==='model'&&p.nativeProcess.label?.trim().toLowerCase()===name).length!==1)throw Error('servicenow_native_model_ambiguous')}
 };
 return{readMetadata,assertNativePlan};
}
