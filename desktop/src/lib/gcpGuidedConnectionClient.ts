import {desktopClient,type ApiResult} from './desktopClient';
import {isGcpGuidedStart,isGcpGuidedState,isGcpProjectId,isGcpAttemptId,type GcpGuidedStart,type GcpGuidedState} from './gcpGuidedConnectionContract';
const unavailable='Google Cloud connection could not be confirmed. Check connection status before trying again.';
const messages:Record<string,string>={gcp_cloud_not_configured:'Google Cloud sign-in is not configured for this service yet.',connection_authority_required:'Your current workspace access does not permit this connection. Sign in again or ask a workspace owner.',desktop_session_required:'Sign in to your workspace again before connecting Google Cloud.',cloud_account_limit_reached:'Your workspace cloud-account allowance is exhausted.',cloud_resource_denied:'Google Cloud denied access to this project. Review the selected account and permissions.',cloud_authorization_invalid:'This sign-in attempt is no longer usable. Start a new connection.',cloud_save_unconfirmed:'The save result is uncertain. Check connection status; do not repeat sign-in yet.'};
async function request(method:'GET'|'POST',path:string,body?:unknown,signal?:AbortSignal):Promise<ApiResult<unknown>>{
 const config=desktopClient.config;
 if(config.apiBase!=='https://visionxixlabs.com'||!config.sessionToken?.startsWith('axm.desk.'))return{ok:false,error:'A paired desktop session at the approved Axiom service is required.'};
 const timeout=AbortSignal.timeout(25000);const combined=signal?AbortSignal.any([signal,timeout]):timeout;
 try{
  combined.throwIfAborted();
  const response=await fetch(`${config.apiBase}/api/desktop/cloud/gcp/guided/${path}`,{method,headers:{Accept:'application/json',Authorization:`Bearer ${config.sessionToken}`,...(method==='POST'?{'Content-Type':'application/json'}:{})},credentials:'omit',redirect:'error',cache:'no-store',signal:combined,...(method==='POST'?{body:JSON.stringify(body??{})}:{})});
  // Bound response size without echoing gateway/provider text.
  const reader=response.body?.getReader();if(!reader)throw new Error('missing_body');let text='';const decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0;
  try{for(;;){combined.throwIfAborted();const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>65536)throw new Error('body_limit');text+=decoder.decode(part.value,{stream:true})}text+=decoder.decode()}finally{void reader.cancel().catch(()=>undefined)}
  combined.throwIfAborted();
  if(desktopClient.config!==config)return{ok:false,error:'Workspace credentials changed. Reopen the Google Cloud connection.'};
  const value=JSON.parse(text) as{ok?:unknown;data?:unknown;error?:unknown};
  if(response.status===401||response.status===403)return{ok:false,error:messages.connection_authority_required};
  if(response.ok&&value?.ok===true&&value.data!==undefined)return{ok:true,data:value.data};
  return{ok:false,error:typeof value?.error==='string'&&Object.prototype.hasOwnProperty.call(messages,value.error)?messages[value.error]:unavailable};
 }catch{return{ok:false,error:unavailable}}
}
export const gcpGuidedConnectionClient={
 async start(signal?:AbortSignal):Promise<ApiResult<GcpGuidedStart>>{const r=await request('POST','start',{},signal);return r.ok?(isGcpGuidedStart(r.data)?{ok:true,data:r.data}:{ok:false,error:unavailable}):r},
 async status(attemptId?:string,signal?:AbortSignal):Promise<ApiResult<GcpGuidedState>>{if(attemptId&&!isGcpAttemptId(attemptId))return{ok:false,error:unavailable};const r=await request('GET',`status${attemptId?`?attemptId=${encodeURIComponent(attemptId)}`:''}`,undefined,signal);return r.ok?(isGcpGuidedState(r.data)&&(!attemptId||r.data.attemptId===attemptId)?{ok:true,data:r.data}:{ok:false,error:unavailable}):r},
 async complete(attemptId:string,resourceId:string,signal?:AbortSignal):Promise<ApiResult<GcpGuidedState>>{if(!isGcpAttemptId(attemptId)||!isGcpProjectId(resourceId))return{ok:false,error:'Select a project from the verified list.'};const r=await request('POST','complete',{attemptId,resourceId},signal);return r.ok?(isGcpGuidedState(r.data)&&r.data.attemptId===attemptId&&(r.data.status!=='connected_read_only'||r.data.connection?.resourceId===resourceId)?{ok:true,data:r.data}:{ok:false,error:unavailable}):r},
 async cancel(attemptId:string,signal?:AbortSignal):Promise<ApiResult<GcpGuidedState>>{if(!isGcpAttemptId(attemptId))return{ok:false,error:unavailable};const r=await request('POST','cancel',{attemptId},signal);return r.ok?(isGcpGuidedState(r.data)&&r.data.attemptId===attemptId?{ok:true,data:r.data}:{ok:false,error:unavailable}):r},
};
