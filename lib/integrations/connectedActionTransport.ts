import 'server-only';
import {z} from 'zod';
import {withGithubAbort,readBoundedGithubBody} from '@/lib/connectors/github/boundedGithubRead';
import {connectedActionIntentSchema,connectedActionReceiptSchema,hasConnectedActionScope,type ConnectedActionIntent,type ConnectedActionResult} from './connectedActionContract';
import {connectedActionId} from './connectedActionIdentity';

export const connectedActionCredentialSchema=z.object({organizationId:z.string().min(1),connectionId:z.string().min(1),connectionRevision:z.string().datetime(),provider:z.enum(['teams','linear']),workspaceId:z.string().uuid(),token:z.string().min(1).max(32768).refine(v=>!/[\x00-\x20\x7f-\x9f]/.test(v)),scopes:z.array(z.string().min(1).max(240)).max(32),expiresAt:z.number().int().safe()}).strict();
export interface ConnectedActionTransportPorts{
 isEnabled?:(provider:'teams'|'linear')=>boolean;
 beforeSubmission?:(operationId:string,intent:Readonly<ConnectedActionIntent>,signal:AbortSignal)=>Promise<()=>void>;
 readCredential?:(intent:Readonly<ConnectedActionIntent>,signal:AbortSignal)=>Promise<unknown>;
 fetch?:typeof fetch;now?:()=>number;
}
/** Server-owned saved operations only. assertCurrent must recheck the durable claim,
 * independent approval, current membership/connection and exact target evidence.
 * No caller credential/approval, arbitrary GraphQL/URL, webhook or automatic retry. */
export function createConnectedActionTransport(ports:ConnectedActionTransportPorts={}){
 return{async execute(input:{operationId:string;intent:ConnectedActionIntent;signal:AbortSignal;assertCurrent:()=>Promise<void|(()=>void)>}):Promise<ConnectedActionResult>{
  let dispatched=false,response:Response|undefined;
  const now=ports.now??Date.now,controller=new AbortController(),signal=AbortSignal.any([input.signal,controller.signal]);
  const timer=setTimeout(()=>controller.abort(),15000),deadline=now()+15000;
  try{
   const intent=connectedActionIntentSchema.parse(input.intent);if(intent.provider==='outlook')return{state:'refused'};
   const guard=()=>{signal.throwIfAborted();if(!ports.isEnabled?.(intent.provider)||!ports.readCredential||!ports.fetch||!Number.isSafeInteger(now())||now()>=deadline||Date.parse(intent.expiresAt)<=now())throw Error('unavailable')};
   let currentFresh:(()=>void)|undefined;
   const current=async()=>{guard();const fresh=await withGithubAbort(input.assertCurrent(),signal);if(fresh!==undefined&&typeof fresh!=='function')throw Error('unavailable');if(typeof fresh==='function')currentFresh=fresh;currentFresh?.();guard()};
   if(input.operationId!==connectedActionId(intent)||typeof input.assertCurrent!=='function')return{state:'refused'};
   await current();
   const credential=connectedActionCredentialSchema.parse(await withGithubAbort(ports.readCredential!(structuredClone(intent),signal),signal));
   const required=intent.provider==='teams'?['ChannelMessage.Send','Team.ReadBasic.All','Channel.ReadBasic.All']:['read',intent.kind==='linear_issue_create'?'issues:create':'write'];
   const ready=()=>credential.organizationId===intent.organizationId&&credential.connectionId===intent.connectionId&&credential.connectionRevision===intent.connectionRevision&&credential.provider===intent.provider&&credential.workspaceId===intent.workspaceId&&credential.expiresAt>now()+15000&&required.every(s=>hasConnectedActionScope(intent.provider,credential.scopes,s)||intent.kind==='linear_issue_create'&&s==='issues:create'&&credential.scopes.includes('write'));
   if(!ready())return{state:'refused'};
   await current();
   const url=intent.provider==='teams'?`https://graph.microsoft.com/v1.0/teams/${encodeURIComponent(intent.teamId)}/channels/${encodeURIComponent(intent.channelId)}/messages`:'https://api.linear.app/graphql';
   let body:unknown;
   if(intent.kind==='teams_channel_message')body={body:{contentType:'text',content:intent.text}};
   else if(intent.kind==='linear_issue_create')body={query:'mutation AxiomCreateIssue($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url team { id } } } }',variables:{input:{teamId:intent.teamId,title:intent.title,...(intent.description?{description:intent.description}:{})}}};
   else body={query:'mutation AxiomUpdateIssue($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { id identifier url team { id } state { id type } } } }',variables:{id:intent.issueId,input:intent.kind==='linear_issue_close'?{stateId:intent.stateId}:{title:intent.title,...(intent.description?{description:intent.description}:{})}}};
   const serializedBody=JSON.stringify(body);
   let intentFresh:(()=>void)|undefined;if(ports.beforeSubmission){intentFresh=await withGithubAbort(ports.beforeSubmission(input.operationId,structuredClone(intent),signal),signal);if(typeof intentFresh!=='function')throw Error('unavailable')}
   const pending=Promise.resolve().then(()=>{guard();if(!ready())throw Error('unavailable');currentFresh?.();intentFresh?.();dispatched=true;return ports.fetch!(url,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{Authorization:`Bearer ${credential.token}`,'Content-Type':'application/json'},body:serializedBody})});
   void pending.then(r=>{if(signal.aborted)void r.body?.cancel().catch(()=>{})},()=>{});
   response=await withGithubAbort(pending,signal);guard();
   if(response.redirected||response.url&&response.url!==url||response.status!==(intent.provider==='teams'?201:200)||response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return{state:'unknown'};
   const raw:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readBoundedGithubBody(response,signal,65536)));
   let receipt:unknown;
   if(intent.provider==='teams'){
    const message=z.object({id:z.string().regex(/^[0-9]{1,24}$/),channelIdentity:z.object({teamId:z.literal(intent.teamId),channelId:z.literal(intent.channelId)}).passthrough()}).passthrough().parse(raw);
    receipt={provider:'teams',teamId:intent.teamId,channelId:intent.channelId,messageId:message.id,url:`https://teams.microsoft.com/l/message/${encodeURIComponent(intent.channelId)}/${message.id}?tenantId=${intent.workspaceId}&groupId=${intent.teamId}`};
   }else{
    const payload=z.object({data:z.record(z.string(),z.unknown()),errors:z.array(z.unknown()).optional()}).parse(raw);if(payload.errors?.length)return{state:'unknown'};
    const result=z.object({success:z.literal(true),issue:z.object({id:z.string().uuid(),identifier:z.string(),url:z.string().url(),team:z.object({id:z.literal(intent.teamId)}),state:z.object({id:z.string().uuid(),type:z.string()}).optional()}).passthrough()}).parse(payload.data[intent.kind==='linear_issue_create'?'issueCreate':'issueUpdate']);
    const issue=result.issue,u=new URL(issue.url);if(u.protocol!=='https:'||u.hostname!=='linear.app'||u.username||u.password||u.port||!u.pathname.split('/').includes(issue.identifier)||intent.kind!=='linear_issue_create'&&issue.id!==intent.issueId||intent.kind==='linear_issue_close'&&(issue.state?.id!==intent.stateId||issue.state.type!=='completed'))return{state:'unknown'};
    receipt={provider:'linear',teamId:intent.teamId,issueId:issue.id,identifier:issue.identifier,url:issue.url};
   }
   const parsed=connectedActionReceiptSchema.parse(receipt);await current();if(!ready())return{state:'unknown'};return{state:'confirmed',receipt:parsed};
  }catch{return{state:dispatched?'unknown':'refused'}}finally{clearTimeout(timer);controller.abort();void response?.body?.cancel().catch(()=>{})}
 }};
}
