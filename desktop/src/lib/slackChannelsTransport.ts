import {slackChannelCursorSchema,parseSlackChannelsData,type SlackChannelsData} from '../../../lib/desktop/slackChannelsContract';
interface Context{getConfig:()=>{apiBase:string;sessionToken?:string};getRevision:()=>number;subscribe:(fn:()=>void)=>()=>void}
export type SlackChannelsResult={ok:true;data:SlackChannelsData}|{ok:false;error:string};
/** Fixed paired GET only: complete-body deadline, bounded response, no provider-write authority. */
export async function readSlackChannels(context:Context,cursor?:string,signal?:AbortSignal):Promise<SlackChannelsResult>{
 const fail=():SlackChannelsResult=>({ok:false,error:'Slack channels could not be confirmed. Reload channels or review the Slack connection.'});
 if(cursor!==undefined&&!slackChannelCursorSchema.safeParse(cursor).success)return fail();
 const config=context.getConfig(),revision=context.getRevision(),base=config.apiBase,token=config.sessionToken;
 if(!token?.startsWith('axm.desk.')||signal?.aborted)return fail();
 const controller=new AbortController();let response:Response|undefined,reader:ReadableStreamDefaultReader<Uint8Array>|undefined,rejectStop!:(e:Error)=>void;
 const stopped=new Promise<never>((_,reject)=>rejectStop=reject);
 const stop=()=>{controller.abort();rejectStop(Error('stopped'));try{void reader?.cancel().catch(()=>{});if(!reader)void response?.body?.cancel().catch(()=>{})}catch{/* Already consumed. */}};
 const unsubscribe=context.subscribe(stop),timer=setTimeout(stop,25000);signal?.addEventListener('abort',stop,{once:true});
 const owns=()=>!controller.signal.aborted&&!signal?.aborted&&context.getConfig()===config&&config.apiBase===base&&config.sessionToken===token&&context.getRevision()===revision;
 try{return await Promise.race([(async()=>{
  response=await fetch(`${base}/api/desktop/integrations/slack/channels${cursor?'?cursor='+encodeURIComponent(cursor):''}`,{method:'GET',credentials:'omit',redirect:'error',cache:'no-store',headers:{Authorization:`Bearer ${token}`},signal:controller.signal});
  if(!owns()){void response.body?.cancel().catch(()=>{});return fail()}
  const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>131072))return fail();
  if(!response.body)return fail();reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
  for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>131072)return fail();chunks.push(chunk.value)}
  if(!owns())return fail();const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!response.ok||body?.ok!==true||Object.keys(body).sort().join(',')!=='data,ok')return fail();
  return{ok:true as const,data:parseSlackChannelsData(body.data)};
 })(),stopped])}catch{return fail()}finally{clearTimeout(timer);unsubscribe();signal?.removeEventListener('abort',stop);try{void reader?.cancel().catch(()=>{});if(!reader)void response?.body?.cancel().catch(()=>{})}catch{/* Already consumed. */}}
}
