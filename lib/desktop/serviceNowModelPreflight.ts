import 'server-only';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {readServiceNowModels} from '@/lib/integrations/servicenow/serviceNowReadAccess';
import {readServiceNowTicketCredential,type ServiceNowCredentialPort} from './serviceNowTicketCredential';
import {ticketReviewScopeSchema,serviceNowTerminalPolicySchema,type TicketReviewScope,type ServiceNowTerminalPolicy} from '@/lib/releaseops/ticketGovernanceReviewContract';
import {serviceNowConnectionSchema} from './serviceNowTicketLifecyclePreparation';
/** No terminal-state inference. Only authenticates a current active native model;
 * the separately reviewed administrator policy supplies allowed closure fields. */
export function createServiceNowModelPreflight(ports:{readConnection:(scope:TicketReviewScope,signal:AbortSignal)=>Promise<unknown>;readCredential:ServiceNowCredentialPort;fetch?:typeof fetch;now?:()=>number}){
 return async(rawScope:TicketReviewScope,rawPolicy:ServiceNowTerminalPolicy,parent:AbortSignal)=>{
  const scope=ticketReviewScopeSchema.parse(rawScope),policy=serviceNowTerminalPolicySchema.parse(rawPolicy),signal=AbortSignal.any([parent,AbortSignal.timeout(15000)]),now=ports.now??Date.now;
  if(policy.organizationId!==scope.organizationId||policy.nativeProcess.kind!=='model')throw Error('servicenow_model_preflight_unavailable');
  async function current(){signal.throwIfAborted();const c=serviceNowConnectionSchema.parse(await ports.readConnection(scope,signal));if(c.organizationId!==scope.organizationId||c.connectionId!==policy.connectionId||c.connectionRevision!==policy.connectionRevision||c.instanceOrigin!==policy.instanceOrigin||c.consentedByUserId!==policy.executorUserId)throw Error('servicenow_model_connection_changed');return c}
  const connection=await current(),credential=await readServiceNowTicketCredential(ports.readCredential,scope,connection,async()=>{await current()},signal);
  const catalog=await readServiceNowModels({instanceOrigin:connection.instanceOrigin,token:{accessToken:credential.accessToken,refreshToken:null,expiresAt:credential.expiresAt,scopes:['axiom.change_management']},signal,fetchImpl:ports.fetch,now});
  const process=policy.nativeProcess,model=catalog.models.find(m=>m.sysId===process.modelSysId);
  if(!model?.active||process.label!==undefined&&process.label!==model.name||sha256ContentHash({instanceOrigin:connection.instanceOrigin,model})!==policy.modelDigest)throw Error('servicenow_model_changed');
  await current();signal.throwIfAborted();const at=now();if(!Number.isFinite(at)||at>=Date.parse(policy.expiresAt))throw Error('servicenow_model_preflight_expired');
  return{organizationId:scope.organizationId,connectionId:connection.connectionId,connectionRevision:connection.connectionRevision,instanceOrigin:connection.instanceOrigin,nativeProcess:policy.nativeProcess,modelDigest:policy.modelDigest,observedAt:new Date(at).toISOString()};
 };
}
