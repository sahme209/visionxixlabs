import {slackNotificationsRequestSchema,parseSlackNotificationsData,type SlackNotificationsData} from '../../../lib/desktop/slackNotificationsContract';
import type {z} from 'zod';
export type SlackNotificationRequest=z.infer<typeof slackNotificationsRequestSchema>;
export type SlackNotificationLookup={approvalId:string}|{operationId:string}|{clientRequestId:string}|{taskId:string}|{taskLinked:'1'};
interface Context{getConfig:()=>{apiBase:string;sessionToken?:string};getRevision:()=>number;subscribe:(fn:()=>void)=>()=>void}
export type SlackNotificationsResult={ok:true;data:SlackNotificationsData}|{ok:false;error:string;errorCode?:'bot_action_task_changed'};
/** Fixed paired notification routes only: complete-body deadline, bounded response, no provider-write authority. */
export async function slackNotificationsRequest(context:Context,body?:SlackNotificationRequest,lookup?:SlackNotificationLookup,signal?:AbortSignal):Promise<SlackNotificationsResult>{
 const fail=():SlackNotificationsResult=>({ok:false,error:'Slack notification outcome could not be confirmed. Reload saved notification history before another action.'});
 if(body&&!slackNotificationsRequestSchema.safeParse(body).success)return fail();
 if(lookup&&(Object.keys(lookup).length!==1||('approvalId'in lookup?!/^slack_notification_approval_[a-f0-9]{64}$/.test(lookup.approvalId):'operationId'in lookup?!/^slack_notification_[a-f0-9]{64}$/.test(lookup.operationId):'taskId'in lookup?!/^bot_[a-f0-9]{64}$/.test(lookup.taskId):'taskLinked'in lookup?lookup.taskLinked!=='1':!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(lookup.clientRequestId))))return fail();
 const config=context.getConfig(),revision=context.getRevision(),base=config.apiBase,token=config.sessionToken;
 if(!token?.startsWith('axm.desk.')||signal?.aborted)return fail();
 const controller=new AbortController();let response:Response|undefined,reader:ReadableStreamDefaultReader<Uint8Array>|undefined,rejectStop!:(e:Error)=>void;
 const stopped=new Promise<never>((_,reject)=>rejectStop=reject);
 const stop=()=>{controller.abort();rejectStop(Error('stopped'));try{void reader?.cancel().catch(()=>{});if(!reader)void response?.body?.cancel().catch(()=>{})}catch{/* Already consumed. */}};
 const unsubscribe=context.subscribe(stop),timer=setTimeout(stop,25000);signal?.addEventListener('abort',stop,{once:true});
 const owns=()=>!controller.signal.aborted&&!signal?.aborted&&context.getConfig()===config&&config.apiBase===base&&config.sessionToken===token&&context.getRevision()===revision;
 try{return await Promise.race([(async()=>{
  response=await fetch(`${base}/api/desktop/integrations/slack/notifications${lookup?'?'+new URLSearchParams(lookup).toString():''}`,{method:body?'POST':'GET',...(body?{body:JSON.stringify(body)}:{}),credentials:'omit',redirect:'error',cache:'no-store',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},signal:controller.signal});
  if(!owns()){void response.body?.cancel().catch(()=>{});return fail()}
  const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>524288))return fail();
  if(!response.body)return fail();reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
  for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>524288)return fail();chunks.push(chunk.value)}
  if(!owns())return fail();const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  const payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!response.ok||payload?.ok!==true||Object.keys(payload).sort().join(',')!=='data,ok'){if(lookup&&('taskId'in lookup||'taskLinked'in lookup)&&response.status===400)return{ok:false as const,error:'Task-linked Slack workflows are not activated on this service yet. Saved tasks remain available.'};if(body?.action==='request'&&payload?.error==='bot_action_task_changed'&&response.status===409)return{ok:false as const,errorCode:'bot_action_task_changed' as const,error:'The saved Bot task changed. Reopen its current version before saving this message.'};return fail()}
  const data=parseSlackNotificationsData(payload.data),a=data.approvals,o=data.operations;
  if(new Set(a.map(row=>row.id)).size!==a.length||new Set(o.map(row=>row.id)).size!==o.length)return fail();
  if(lookup&&('approvalId'in lookup?a.length!==1||a[0].id!==lookup.approvalId||o.length!==0:'operationId'in lookup?o.length!==1||o[0].id!==lookup.operationId||a.length!==0:'taskId'in lookup?a.some(row=>row.intent.sourceTask?.taskId!==lookup.taskId)||o.some(row=>row.intent.sourceTask?.taskId!==lookup.taskId):'taskLinked'in lookup?a.some(row=>!row.intent.sourceTask)||o.some(row=>!row.intent.sourceTask):a.length!==1||a[0].clientRequestId!==lookup.clientRequestId||o.length!==0))return fail();
  if(body){
   const oneApproval=a.length===1&&o.length===0,oneOperation=o.length===1&&a.length===0;
   if(body.action==='request'&&a.length===1&&(a[0].intent.sourceTask?.taskId!==body.sourceTask?.taskId||a[0].intent.sourceTask?.taskVersion!==body.sourceTask?.expectedVersion))return fail();
   if(body.action==='request'&&(!oneApproval||a[0].clientRequestId!==body.clientRequestId||a[0].intent.channelId!==body.channelId||a[0].intent.text!==body.text))return fail();
   if(body.action==='approve'&&(!oneApproval||a[0].id!==body.approvalId||a[0].state!=='approved'||a[0].version!==1))return fail();
   if(body.action==='cancel'&&(!oneApproval||a[0].id!==body.approvalId||a[0].state!=='cancelled'||a[0].version<=body.expectedVersion))return fail();
   if(body.action==='prepare'&&(!oneOperation||o[0].state!=='prepared'||o[0].version!==0))return fail();
   if((body.action==='execute'||body.action==='recover'||body.action==='cancel_operation')&&(!oneOperation||o[0].id!==body.operationId||o[0].version<body.expectedVersion||(body.action==='cancel_operation'?o[0].state!=='cancelled':!['dispatching','sent','unknown','refused'].includes(o[0].state))))return fail();
  }
  return{ok:true as const,data};
 })(),stopped])}catch{return fail()}finally{clearTimeout(timer);unsubscribe();signal?.removeEventListener('abort',stop);try{void reader?.cancel().catch(()=>{});if(!reader)void response?.body?.cancel().catch(()=>{})}catch{/* Already consumed. */}}
}
