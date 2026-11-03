import 'server-only';
import {SlackNotificationUnavailable,type SlackNotificationStore} from './slackNotificationStore';
import type {SlackNotificationScope,SlackNotificationIntent,SlackNotificationResult} from './slackNotificationContract';
export interface SlackNotificationTransport{kind:'slack_notification_transport_v1';execute(input:{operationId:string;intent:SlackNotificationIntent;signal:AbortSignal;assertCurrent:()=>Promise<void|(()=>void)>}):Promise<SlackNotificationResult>}
export function createSlackNotificationExecutor(store:SlackNotificationStore,transport?:SlackNotificationTransport,now:()=>Date=()=>new Date(),outbound?:{captureCurrent:(scope:SlackNotificationScope,id:string,intent:SlackNotificationIntent,signal:AbortSignal)=>Promise<()=>void>}){return{async run(scope:SlackNotificationScope,id:string,callerSignal?:AbortSignal){
 callerSignal?.throwIfAborted();if(!transport||transport.kind!=='slack_notification_transport_v1')throw new SlackNotificationUnavailable();
 const claim=await store.claim(scope,id);if(!claim.claimed){callerSignal?.throwIfAborted();return store.recover(scope,id)}
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,rejectStop!:(e:Error)=>void;
 const stopped=new Promise<never>((_,reject)=>{rejectStop=reject});void stopped.catch(()=>{});
 const stop=()=>{controller.abort();rejectStop(Error('slack_notification_stopped'))};
 callerSignal?.addEventListener('abort',stop,{once:true});if(callerSignal?.aborted)stop();
 const guard=()=>{controller.signal.throwIfAborted();callerSignal?.throwIfAborted();if(now().getTime()>=claim.leaseExpiresAt.getTime())throw Error('expired')};
 try{guard();const intent=await Promise.race([store.beforeDispatch(scope,id),stopped]);guard();const remaining=Math.min(25000,claim.leaseExpiresAt.getTime()-now().getTime());if(!Number.isFinite(remaining)||remaining<=0)throw Error('expired');timer=setTimeout(stop,remaining);
 const result=await Promise.race([Promise.resolve().then(()=>{guard();return transport.execute({operationId:id,intent:structuredClone(intent),signal:controller.signal,assertCurrent:async()=>{guard();if(outbound){const fresh=await Promise.race([outbound.captureCurrent(scope,id,claim.intent,controller.signal),stopped]);fresh();guard();return fresh}await Promise.race([store.beforeDispatch(scope,id),stopped]);guard()}})}),stopped]);guard();return await store.finish(scope,id,result);
 }catch{return store.finish(scope,id,{state:'unknown'})}finally{clearTimeout(timer);callerSignal?.removeEventListener('abort',stop);controller.abort()}
}}}
